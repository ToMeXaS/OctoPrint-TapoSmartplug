# OctoPrint-TapoSmartplug

This is a fork of https://github.com/jneilliii/OctoPrint-TPLinkSmartplug with integration for the Tapo P100 smart plug using the [PyP100 library](https://github.com/fishbigger/TapoP100)

I have renamed all the TP-Link references to Tapo and removed the bits to do with timed events as these don't appear to work with the P100 in LAN mode which was the aim. Also as the plug I have doesn't have any power information I have removed that as well.

I am not a Python developer and this is the first time I have dealt with an OctoPrint plugin so if anyone wants to fork this and take it forward then go for it or alternatively it could be added to the TP-Link plugin with an option for Plug type.

I did have to upgrade my Octoprint to Python3 due to what I believe is a dependency of the PyP100 library.

At the moment the button/icon works and will turn the plug on and off, turn on at startup and the idle timeout also appears to be working but I am having no luck with the upload notification, the refresh of state in octoprint if I manually turn the plug on/off doesn't appear to work and possibly a host of other notifications.

Not bad for a few hours seeing if it would work.

##  Screenshots

## Setup

Install manually using this URL:

    https://github.com/Tyfy/OctoPrint-TapoSmartplug/archive/master.zip


## Configuration

Once installed go into settings and enter the ip address, username and password for your Tapo Smartplug device. Adjust additional settings as needed.

## Settings Explained
- **IP**
  - IP or hostname of plug to control. For strip devices use the format `<ip>/<0 based socket index>`, ie 192.168.0.2/0 would control the first socket in the strip.
- **Label**
  - Label to use for title attribute on hover over button in navbar.
- **Icon Class**
  - Class name from [fontawesome](https://fontawesome.com/v3.2.1/icons/) to use for icon on button.
- **Username**
  - Username to use to connect to the smart plug.
- **Password**
  - Password to use to connect to the smart plug.
- **Warning Prompt**
  - Always warn when checked.
- **Warn While Printing**
  - Will only warn when printer is printing.
- **On with Upload**
  - When checked, this will allow connected slicers to power on the device when uploading a file.  This requires OctoPrint 1.4.1rc or higher, and does not currently support uploading through the web browser.
- **GCODE Trigger**
  - When checked this will enable the processing of M80 and M81 commands from gcode to power on/off plug.  Syntax for gcode command is M80/M81 followed by hostname/ip.  For example if your plug is 192.168.1.2 your gcode command would be **M80 192.168.1.2**
  - Added with version 0.9.5 you can now use the custom gcode commands `@TAPOON` and `@TAPOOFF` followed by the IP address of the plug.  This option will only work for plugs with GCODE processing enabled.  For example if your plug is 192.168.1.2 your gcode command would be **@TAPOON 192.168.1.2**
- **Auto Connect**
  - Automatically connect to printer after plug is powered on.
  - Will wait for number of seconds configured in **Auto Connect Delay** setting prior to attempting connection to printer.
- **Auto Disconnect**
  - Automatically disconnect printer prior to powering off the plug.
  - Will wait for number of seconds configured in **Auto Disconnect Delay** prior to powering off the plug.
- **Run System Command After On**
  - When checked will run system command configured in **System Command On** setting after a delay in seconds configured in **System Command On Delay**.
- **Run System Command Before Off**
  - When checked will run system command configured in **System Command Off** setting after a delay in seconds configured in **System Command Off Delay**.
  
## Get Help

If you experience issues with this plugin or need assistance please use the issue tracker by clicking issues above.
