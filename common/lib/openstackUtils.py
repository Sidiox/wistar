import json
import logging
import mmap
import time

from wistar import configuration

import openstack
from openstack.config import loader
from openstack import utils
from openstack.cloud import OpenStackCloud
from keystoneauth1.exceptions.http import Unauthorized as ErrorUnauthorized


logger = logging.getLogger(__name__)


def create_connection():
    """
    Creates an connection object based on the configuration mode
    Either uses the openstacksdk mode which searches for clouds.yaml
    Or uses the configuration options
    """
    if configuration.openstack_mode == "auto":
        return openstack.connect(cloud=configuration.openstack_cloud)
    else:
        return openstack.connect(
            auth_url=configuration.openstack_host,
            project_name=configuration.openstack_project,
            username=configuration.openstack_user,
            password=configuration.openstack_password,
            region_name=configuration.openstack_region
        )


def connect_to_openstack():
    """
    Tries to connect to the selected openstack cloud
    """
    logger.debug("--- connect_to_openstack ---")

    connection = create_connection()
    try:
        connection.authorize()
        return True
    except ErrorUnauthorized:
        return False

def get_glance_image_list():
    # logger.debug("--- get_glance_image_list ---")

    connection = create_connection()

    images = connection.image.images()

    return [image.to_dict() for image in images if image.status == "active"]


def get_glance_image_detail(image_id):
    logger.debug("---get_glance_image-detail_by_id")
    connection = create_connection()

    result = connection.image.get_image(image_id)
    if result is None:
        return None
    return result.to_dict()

def get_glance_image_detail_by_name(image_name):
    logger.debug("-- get glance image detail by name")
    connection = create_connection()

    result = connection.image.find_image(image_name)
    if result is None:
        return None
    else:
        return result.to_dict()



def get_image_id_for_name(image_name):
    connection = create_connection()

    result = connection.image.find_image(image_name)
    if result is None:
        return None
    else:
        return result.to_dict()["id"]

def upload_image_to_glance(name, image_file_path):
    """
    :param name: name of the image to be created
    :param image_file_path: path of the file to upload
    :return: json encoded results string 
    """
    #FIXME this is not properly checked yet
    connection = create_connection()

    image_attrs = dict()
    image_attrs['disk_format'] = 'qcow2'
    image_attrs['container_format'] = 'bare'
    image_attrs['name'] = name

    f = open(image_file_path, 'rb')
    fio = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)

    image_attrs['data'] = fio

    connection.images.upload_image(**image_attrs)


def get_nova_flavors(project_name):
    connection = create_connection()

    all_flavors = connection.compute.flavors()

    flavor_dicts = [flavor.to_dict() for flavor in all_flavors]

    logger.debug("FLAVORS")
    logger.debug(str(flavor_dicts))
    
    return json.dumps(flavor_dicts)
    # return [flavor.to_dict() for flavor in connection.compute.flavors()]

def get_nova_serial_console(instance_name):
    """
    Get the websocket URL for the serial proxy for a given nova server (instance)
    :param instance_name: name of the instance
    :return: websocket url ws://x.x.x.x:xxxx/token=xxxxx
    """
    #FIXME no proper openstacksdk implementation yet
    connection = create_connection()
    server = connection.compute.find_server(instance_name)

    if server == None:
        return None
    # Trying to get the console via a manual query

    # First build the cor

    cloud = OpenStackCloud()
    project_id = cloud.current_project_id

    data = '{"os-getVNCConsole": {"type": "novnc"}}'
    url = create_nova_url('/%s/servers/%s/action' % (project_id, server.id))
    logger.debug("nova console: trying: " + str(url))
    try:
        project_auth_token = connection.authorize()
        request = urllib2.Request(url)
        request.add_header("Content-Type", "application/json")
        request.add_header("charset", "UTF-8")
        request.add_header("X-Auth-Token", project_auth_token)
        request.get_method = lambda: 'POST'
        result = urllib2.urlopen(request, data)
        console_json_data = json.loads(result.read())
        logger.debug(json.dumps(console_json_data, indent=2))
        return console_json_data["console"]["url"]
    except URLError as e:
        logger.error("Could not get serial console to instance: %s" % instance_name)
        logger.error("error was %s" % str(e))
        return None



def create_nova_url(url):
    """
    Creates a nova url based on the service and endpoint in the sdk
    """
    conn = create_connection()

    nova_id = conn.identity.find_service("nova").id

    endpoint_query == {
        "service_id": nova_id,
        "interface": "public"
    }

    # This should only give one result
    endpoint = conn.identity.endpoints(**endpoint_query)

    return endpoint[0].url + url




def get_project_id(project_name):
    """
    :param project_name: name of the project to search for
    """

    connection = create_connection()
    cloud = OpenStackCloud()
    logger.debug("--get project id")
    return cloud.current_project_id
    logger.debug("--- all projects--")
    logger.debug(str(connection.__dict__))
    logger.debug("--properties")
    for project in connection.identity.projects(user_id=cloud.current_user_id):
        logger.debug(str(project))
    logger.debug("Find project")
    result = connection.identity.find_project(project_name, user_id=cloud.current_user_id)
    if result is None:
        return None
    else:
        return result.to_dict()["id"]


def get_consumed_management_ips():
    """
    Return a list of dicts of the format
    [
        { "ip-address": "xxx.xxx.xxx.xxx"}
    ]
    This mimics the libvirt dnsmasq format for dhcp reservations
    This is used in the wistarUtils.get_dhcp_reserved_ips() as a single place to
    get all reserved management ips
    :return: list of dicts
    """
    ips = []
    connection = create_connection()

    mgmt_network = connection.network.find_network(configuration.openstack_mgmt_network)
    if mgmt_network is None:
        return ips

    for port in connection.network.ports(network_id=mgmt_network.id):
        for fixed_ip in port.fixed_ips:
            fip = {}
            logger.debug(fixed_ip)
            fip["ip-address"] = fixed_ip["ip_address"]
            ips.append(fip)

    logger.debug(str(ips))
    return ips


def get_minimum_flavor_for_specs(project_name, cpu, ram, disk):
    """
    Query nova to get all flavors and return the flavor that best matches our desired constraints
    :param project_name: name of the project to check for flavors
    :param cpu: number of cores desired
    :param ram:  amount of ram desired in MB
    :param disk: amount of disk required in GB
    :return: flavor object {"name": "m1.xlarge"}
    """

    emergency_flavor = dict()
    emergency_flavor['name'] = "m1.large"

    connection = create_connection()
    logger.debug("Trying to determine minumum flavor")
    flavors = connection.compute.flavors()
    flavors = [flavor.to_dict() for flavor in flavors]

    cpu_candidates = list()
    ram_candidates = list()
    disk_candidates = list()
    logger.debug("checking flavors")

    # first, let's see if we have an exact match!
    for f in flavors:
        logger.debug("checking flavor: " + f["name"])
        if f["vcpus"] == cpu and f["ram"] == ram and f["disk"] == disk:
            return f

    logger.debug("not exact match yet")
    # we don't have an exact match yet!
    for f in flavors:
        logger.debug(str(f["vcpus"]) + " " + str(cpu))
        if "vcpus" in f and f["vcpus"] >= int(cpu):
            cpu_candidates.append(f)

    logger.debug("got cpu candidates: " + str(len(cpu_candidates)))

    for f in cpu_candidates:
        if "ram" in f and f["ram"] >= ram:
            ram_candidates.append(f)

    logger.debug("got ram candidates: " + str(len(ram_candidates)))

    for f in ram_candidates:
        if "disk" in f and f["disk"] >= disk:
            disk_candidates.append(f)

    logger.debug("got disk candidates: " + str(len(disk_candidates)))

    if len(disk_candidates) == 0:
        # uh-oh, just return the largest and hope for the best!
        return emergency_flavor
    elif len(disk_candidates) == 1:
        return disk_candidates[0]
    else:
        # we have more than one candidate left
        # let's find the smallest flavor left!
        cpu_low = 99
        disk_low = 999
        ram_low = 99999
        for f in disk_candidates:
            if f["vcpus"] < cpu_low:
                cpu_low = f["vcpus"]
            if f["ram"] < ram_low:
                ram_low = f["ram"]
            if f["disk"] < disk_low:
                disk_low = f["disk"]

        for f in disk_candidates:
            if f["vcpus"] == cpu_low and f["ram"] == ram_low and f["disk"] == disk_low:
                # found the lowest available
                logger.debug("return lowest across all axis")
                return f
        for f in disk_candidates:
            if f["vcpus"] == cpu_low and f["ram"] == ram_low:
                # lowest available along ram and cpu axis
                logger.debug("return lowest across cpu and ram")
                return f
        for f in disk_candidates:
            if f["vcpus"] == cpu:
                logger.debug("return lowest cpu only")
                logger.debug(f)
                return f

        # should not arrive here :-/
        logger.debug("got to the impossible")
        return disk_candidates[0]

def create_stack(stack_name, template_string):
    """
    Creates a Stack via a HEAT template
    :param stack_name: name of the stack to create
    :param template_string: HEAT template to be used
    :return: JSON response from HEAT-API or None on failure
    """

    connection = create_connection()

    template = json.loads(template_string)

    heat_data = {}
    heat_data["name"] = stack_name
    heat_data["template"] = template

    # result = connection.orchestration.create_stack({"name"})

    result = connection.orchestration.create_stack(preview=False, **heat_data)
    logger.debug(result)
    return result

def delete_stack(stack_name):
    """
    Deletes a stack from OpenStack
    :param stack_name: name of the stack to be deleted
    :return: JSON response fro HEAT API
    """
    connection = create_connection()

    stack_details = get_stack_details(stack_name)
    if stack_details is None:
        return None
    else:
        connection.orchestration.delete_stack(stack_details["id"])

def get_stack_details(stack_name):
    """
    Returns python object representing Stack details
    :param stack_name: name of the stack to find
    :return: stack object or None if not found!
    """
    logger.debug("--- get_stack_details ---")

    connection = create_connection()

    result = connection.orchestration.find_stack(stack_name)
    if result is None:
        logger.debug("stack doesn't exist yet")
        return None

    else:
        return result.to_dict()