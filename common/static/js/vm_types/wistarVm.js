// provide a base class for all topology Icons
// provides only common attributes required by all virtual machines

draw2d.shape.node.wistarVm = draw2d.shape.basic.Image.extend({
    NAME: "draw2d.shape.node.wistarVm",
    EDIT_POLICY: false,
    /*
        the following attributes should encapsulate all the items necessary
        to fully configure a VM. To create a new VM with special properties, extend
        this class and override any of these as necessary. See the space.js for an example
    */

    // number of vCPU this VM should have
    VCPU: 1,
    // amount of RAM
    VRAM: 1024,
    // how should interfaces be named this will be used when shown in the UI
    // as well as configuration data sent to the VM
    INTERFACE_PREFIX: "eth",
    // this will configure the interface type in the libvirt domain configuration file
    // example: virtio , e1000
    INTERFACE_TYPE: "virtio",
    // management interface prefix if different than normal interfaces
    // i.e. fxp0 and ge-0/0/0 for vmx
    MANAGEMENT_INTERFACE_PREFIX: "eth",
    // position is where will we put the interface used for management
    // some VMs require the first interface be management
    // others will be last
    // 0 will be the first interface defined, -1 will be the last
    MANAGEMENT_INTERFACE_INDEX: -1,
    // this will configure the interface type for management interfaces, may be different that data interfaces
    MANAGEMENT_INTERFACE_TYPE: "virtio",
    // KVM configuration file. Must exist in ajax/templates/ajax/kvm/
    DOMAIN_CONFIGURATION_FILE: "domain.xml",
    // UI icon width
    ICON_WIDTH: 50,
    // UI icon height
    ICON_HEIGHT: 50,
    // UI icon file - must exist in common/static/images/
    ICON_FILE: "/static/images/server.png",
    // if we need a parent / child VM - set it's type and wiring here
    // the user will select the RE or Parent VM from the UI and we will
    // also instantiate it's child defined here. Must be the js object
    // for example: COMPANION_TYPE: "draw2d.shape.node.vqfxCosim",
    COMPANION_TYPE: "",
    // This defines which interface(s) will be used to connect to a common bridge between
    // the parent and the child. For example: COMPANION_INTERFACE_LIST: ["1"],
    COMPANION_INTERFACE_LIST: [],
    // Should we connect all data interfaces to both companions? Required for vQFX for example
    COMPANION_INTERFACE_MIRROR: false,
    // pci slot offset. We need to ensure that all interfaces defined in the libvirt XML domain definition
    // are unique. As such, set an offset for all companion interfaces. Most VMs have no more than
    // 20 interfaces, so 19 is a safe bet
    COMPANION_INTERFACE_MIRROR_OFFSET: 19,
    // PCI Slot offset
    // Some VMs look for a specific PCI offset for the first interface, set it here.
    // all additional interfaces will be incremented by 1
    // for example: <address type='pci' domain='0x0000' bus='0x00' slot='0x03' function='0x0'/>
    PCI_SLOT_OFFSET: 3,
    // some VMs require at least 1 interface be unused but present. Use this to connect it to a dummy bridge
    DUMMY_INTERFACE_LIST: [],
    // if the VM requires a secondary disk be attached, this will define the bus type in the libvirt XML
    // can be ide, usb or any other option that libvirt supports
    SECONDARY_DISK_TYPE: "",
    // same for teriary disk. vMX uses both a secondary and tertiary disk, one an ide and one a usb
    TERTIARY_DISK_TYPE: "",
    // set's the SMBIOS string in the libvirt XML
    /*
     <system>
      <entry name='manufacturer'>Juniper</entry>
      <entry name='product'>VM-vmx01-161-re-0</entry>
      <entry name='version'>0.1.0</entry>
    </system>
    */
    SMBIOS_PRODUCT_STRING_PREFIX: "Wistar-",
    SMBIOS_PRODUCT_STRING_SUFFIX: "-VM",
    SMBIOS_MANUFACTURER: "Wistar",
    SMBIOS_VERSION: "2.0",
    // if the VM supports cloud-init, set to true.
    // the UI will present an option to pass a cloud-init config script to the device
    // useful for things like ubuntu cloud images
    // wistar will automatically create a cloud-init script to configure tings like
    // management IP, hostname, etc
    CLOUD_INIT_SUPPORT: false,

    /*
        End configurable options
    */

    init: function() {
	    this._super(this.ICON_FILE, this.ICON_WIDTH, this.ICON_HEIGHT);
    },
    setup: function(type, label, ip, pw, image) {
		this.setIp(ip);
        this.setImage(image);
		this.setPassword(pw);
		this.setType(type);
		this.setLabel(label);
    },
    getUserData: function() {
        if (this.userData != undefined) {
            return this.userData;
        } else {
            this.userData = {};
            return this.userData;
        }
    },
    getType: function() {
        if (this.getUserData()["type"] != undefined) {
	        return this.getUserData()["type"];
        } else {
            return "linux";
        }
    },
    setType: function(type) {
	    var ud = this.getUserData();
	    ud["type"] = type;
    },
    getCpu: function() {
        if (this.getUserData()["cpu"] != undefined) {
	        return this.getUserData()["cpu"];
        } else {
            return this.VCPU;
        }
    },
    setCpu: function(cpu) {
	    var ud = this.getUserData();
	    ud["cpu"] = cpu;
    },
    getRam: function() {
        if (this.getUserData()["ram"] != undefined) {
	        return this.getUserData()["ram"];
        } else {
            // return magic number 2 - all older version of wistar defaulted to 2048MB RAM
            return this.VRAM;
        }
    },
    setRam: function(ram) {
	    var ud = this.getUserData();
	    ud["ram"] = ram;
    },
    getSecondaryDiskType: function() {
        return this.SECONDARY_DISK_TYPE;
    },
    getTertiaryDiskType: function() {
        return this.TERTIARY_DISK_TYPE;
    },

    getSecondaryDisk: function() {
        if (this.getUserData()["secondaryDisk"] != undefined) {
	        return this.getUserData()["secondaryDisk"];
        } else {
            return "";
        }
    },
    setSecondaryDisk: function(disk_id) {
	    var ud = this.getUserData();
	    ud["secondaryDisk"] = disk_id;
    },
    getTertiaryDisk: function() {
        if (this.getUserData()["tertiaryDisk"] != undefined) {
	        return this.getUserData()["tertiaryDisk"];
        } else {
            return "";
        }
    },
    setTertiaryDisk: function(disk_id) {
	    var ud = this.getUserData();
	    ud["tertiaryDisk"] = disk_id;
    },
    getMgmtInterface: function() {
        // can we declare this now?
        if (this.MANAGEMENT_INTERFACE_INDEX == 0) {
            return this.MANAGEMENT_INTERFACE_PREFIX + "0";
        } else {
            // only an icon that extends 'standalone' can set this properly
            // i.e. it will have a port with connections, so we can determine the index
            // of the 'last' port - see standaloneIcon.js for an example
            return this.MANAGEMENT_INTERFACE_PREFIX;
        }
    },
    getPassword: function() {
        if (this.getUserData()["password"] != undefined) {
        	return this.getUserData()["password"];
        } else {
            return "NA";
        }
    },
    setPassword: function(pw) {
    	var ud = this.getUserData();
    	ud["password"] = pw;
    },
    getImage: function() {
        if (this.getUserData()["image"] != undefined) {
        	return this.getUserData()["image"];
        } else {
            return "0";
        }
    },
    setImage: function(im) {
    	var ud = this.getUserData();
    	ud["image"] = im;
    },
    setIp: function(ip) {
        var ud = this.getUserData();
        ud["ip"] = ip;
    },
    getIp: function() {
        if (this.getUserData()["ip"] != undefined) {
            return this.getUserData()["ip"];
        } else {
            return "";
        }
    },
    getName: function() {
        if (this.getUserData()["name"] != undefined) {
    	    return this.getUserData()["name"];
        } else {
            return "unnamed_vm";
        }
    },
    setName: function(name) {
    	var ud = this.getUserData();
    	ud["name"] = name;
    },
    getLabel: function() {
        if (this.getUserData()["name"] != undefined) {
    	    return this.getUserData()["name"];
        } else {
            return "unnamed_vm";
        }
    },
    setLabel: function(label) {
        var ud = this.getUserData();
    	ud["label"] = label;
    },
    getCompanionType: function() {
        return this.COMPANION_TYPE;
    },
    getInterfacePrefix: function() {
        return this.INTERFACE_PREFIX;
    },
    // allow override in case of instance specific items required in string
    getSmBiosProductString: function() {
        var instance_name = this.getName().replace("-", "_");
        return this.SMBIOS_PRODUCT_STRING_PREFIX + instance_name + this.SMBIOS_PRODUCT_STRING_SUFFIX;
    },

    setPersistentAttributes: function(memento) {
    	this._super(memento);
    	this.setImage(memento.userData.image);
        this.setType(memento.userData.type);
        this.setPassword(memento.userData.password);
        this.setCpu(memento.userData.cpu);
        this.setRam(memento.userData.ram);
        this.setIp(memento.userData.ip);
        this.setLabel(memento.userData.name);
        this.setName(memento.userData.name);
        this.setSecondaryDisk(memento.userData.secondaryDisk);
        this.setTertiaryDisk(memento.userData.tertiaryDisk);
    },
    getPersistentAttributes: function() {
        // force grabbing the mgnt interface
        var ud = this.getUserData();
        ud["mgmtInterface"] = this.getMgmtInterface();
        ud["wistarVm"] = true;
        ud["cpu"] = this.getCpu();
        ud["ram"] = this.getRam();
        ud["interfacePrefix"] = this.INTERFACE_PREFIX;
        ud["interfaceType"] = this.INTERFACE_TYPE;
        ud["configurationFile"] = this.DOMAIN_CONFIGURATION_FILE;
        ud["pciSlotOffset"] = this.PCI_SLOT_OFFSET;
        ud["mgmtInterfaceIndex"] = this.MANAGEMENT_INTERFACE_INDEX;
        ud["mgmtInterfacePrefix"] = this.MANAGEMENT_INTERFACE_PREFIX;
        ud["mgmtInterfaceType"] = this.MANAGEMENT_INTERFACE_TYPE;
        ud["dummyInterfaceList"] = this.DUMMY_INTERFACE_LIST;
        ud["companionInterfaceList"] = this.COMPANION_INTERFACE_LIST;
        ud["companionInterfaceMirror"] = this.COMPANION_INTERFACE_MIRROR;
        ud["companionInterfaceMirrorOffset"] = this.COMPANION_INTERFACE_MIRROR_OFFSET;
        ud["companionType"] = this.COMPANION_TYPE;
        ud["secondary_disk_type"] = this.SECONDARY_DISK_TYPE;
        ud["tertiary_disk_type"] = this.TERTIARY_DISK_TYPE;
        ud["smbios_product_string"] = this.getSmBiosProductString();
        ud["smbios_version"] = this.SMBIOS_VERSION;
        ud["smbios_manufacturer"] = this.SMBIOS_MANUFACTURER;
        ud["cloud_init_support"] = this.CLOUD_INIT_SUPPORT;

        return this._super();
    },
    // override default dc handler
    onDoubleClick: function() {
        return;
    },
});