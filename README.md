INDAIR


A userscript that enables per-key RGB customization in NuPhy IO for the NuPhy Air75 V3 ISO.
Tested with firmware 1.0.23.6 BETA 2 and Violentmonkey. Other models and firmware versions have not been verified.
Requirements
- A Chromium-based browser with WebHID support.
- Violentmonkey or Tampermonkey.
- A NuPhy Air75 V3 ISO connected via USB.
Installation
1. Install Violentmonkey or Tampermonkey.
2. Import rgb.js into your userscript manager and enable it.
3. Open NuPhy IO and connect your keyboard.
4. Reload the page if it was already open.
5. Open Lighting Effects and select Custom.
6. Select the keys you want to customize, then choose a color.
If Custom does not appear, switch to another tab within NuPhy IO and return to Lighting Effects. If necessary, restart your browser.
Saving and restoring colors
The keyboard retained its custom colors through a computer shutdown and restart during testing.
The script also saves a local backup of your color choices in the browser and restores them when NuPhy IO is opened and the keyboard is connected. Clearing the site's browser data removes this backup.
Color retention after a complete loss of keyboard power has not been verified.
How it works
INDAIR enables an existing Custom RGB mode through NuPhy IO's internal JavaScript API. It detects the active keyboard profile and uses the app's existing commands to control individual key colors.
It does not modify or flash the keyboard's firmware. Automatic activation sets brightness to 100%, which you can adjust afterward.
Limitations
- Currently targets the Air75 V3 ISO.
- Depends on NuPhy IO's internal API and may need updating when the website changes.
- Local color backups are specific to the browser profile where the script is installed.
- Uses NuPhy IO's existing ISO key mapping; complete coverage of every key has not been verified.
Disclaimer
INDAIR is an unofficial project and is not affiliated with or endorsed by NuPhy. Use at your own risk.
