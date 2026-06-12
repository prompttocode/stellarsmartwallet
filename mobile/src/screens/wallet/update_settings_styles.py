import re

with open('SettingsScreen.tsx', 'r') as f:
    content = f.read()

# Replace specific colors
replacements = {
    r"backgroundColor: '#F5F6F8'": "backgroundColor: '#000000'", # screen
    r"backgroundColor: '#FFFFFF'": "backgroundColor: 'rgba(255,255,255,0.05)'", # groupCard, networkCard, profileCard, signOutRow, sheet
    r"backgroundColor: 'rgba\(17,19,24,0\.46\)'": "backgroundColor: 'rgba(5,16,25,0.42)'", # centerModalOverlay
    r"backgroundColor: 'rgba\(17,19,24,0\.38\)'": "backgroundColor: 'rgba(5,16,25,0.42)'", # sheetOverlay
    r"backgroundColor: '#EEF0F3'": "backgroundColor: 'rgba(255,255,255,0.1)'", # badge
    r"backgroundColor: '#F1F2F4'": "backgroundColor: 'rgba(255,255,255,0.05)'", # segmented
    r"backgroundColor: '#F0F1F3'": "backgroundColor: 'rgba(255,255,255,0.1)'", # rowIcon, sheetClose
    r"backgroundColor: '#ECEEF1'": "backgroundColor: 'rgba(255,255,255,0.1)'", # detailIcon
    r"backgroundColor: '#E9EBEE'": "backgroundColor: 'rgba(255,255,255,0.1)'", # manageWalletIcon
    r"backgroundColor: '#F4F5F7'": "backgroundColor: 'rgba(255,255,255,0.05)'", # manageWalletRow
    r"backgroundColor: '#F7F8F9'": "backgroundColor: 'rgba(255,255,255,0.03)'", # detailGroup, technicalCard
    r"backgroundColor: '#EFF1F3'": "backgroundColor: 'rgba(255,255,255,0.1)'", # modalSecondaryButton, toolModalIcon
    r"backgroundColor: '#F3F4F6'": "backgroundColor: 'rgba(255,255,255,0.1)'", # walletAction
    r"backgroundColor: '#FCEDEF'": "backgroundColor: 'rgba(255,82,82,0.15)'", # signOutIcon
    r"backgroundColor: '#111318'": "backgroundColor: '#B8FF45'", # modalPrimaryButton

    # Borders & Dividers
    r"borderColor: '#E5E7EB'": "borderColor: 'rgba(255,255,255,0.1)'",
    r"backgroundColor: '#EBEDF0'": "backgroundColor: 'rgba(255,255,255,0.06)'",
    r"backgroundColor: '#D6D9DE'": "backgroundColor: 'rgba(255,255,255,0.2)'", # sheetHandle

    # Text Colors
    r"color: '#2C3138'": "color: '#FFFFFF'",
    r"color: '#20242A'": "color: '#FFFFFF'",
    r"color: '#252930'": "color: '#FFFFFF'",
    r"color: '#282C33'": "color: '#FFFFFF'",
    r"color: '#272B32'": "color: '#FFFFFF'",
    r"color: '#24282F'": "color: '#FFFFFF'",
    r"color: '#292E35'": "color: '#FFFFFF'",
    r"color: '#30343B'": "color: '#FFFFFF'",
    r"color: '#343941'": "color: '#FFFFFF'",
    r"color: '#343840'": "color: '#000000'", # modalSecondaryText

    r"color: '#888E97'": "color: '#A1B0C8'",
    r"color: '#4A5059'": "color: '#A1B0C8'",
    r"color: '#8A9099'": "color: '#A1B0C8'",
    r"color: '#747A84'": "color: '#A1B0C8'",
    r"color: '#7B818A'": "color: '#A1B0C8'",
    r"color: '#838993'": "color: '#A1B0C8'",
    r"color: '#858B94'": "color: '#A1B0C8'",
    r"color: '#646A73'": "color: '#A1B0C8'",
    r"color: '#717781'": "color: '#A1B0C8'",
    r"color: '#7A8089'": "color: '#A1B0C8'",
    r"color: '#7D838C'": "color: '#A1B0C8'",
    r"color: '#737984'": "color: '#A1B0C8'",
    r"color: '#7D838C'": "color: '#A1B0C8'",

    r"color: '#C23E46'": "color: '#FF5252'",
    
    # Icons
    r'color="#22262D"': 'color="#FFFFFF"',
    r'color="#333841"': 'color="#FFFFFF"',
    r'color="#30353D"': 'color="#FFFFFF"',
    r'color="#4B5058"': 'color="#FFFFFF"',
    r'color="#8B919A"': 'color="#A1B0C8"',
    r'color="#A3A8B0"': 'color="#A1B0C8"',
    r'color="#9BA0A8"': 'color="#A1B0C8"',
    r'color="#C23E46"': 'color="#FF5252"',
    r'color="#252A31"': 'color="#FFFFFF"',
}

# Special override for sheet background
content = content.replace("backgroundColor: '#FFFFFF', // sheet", "backgroundColor: '#111318',")
# We will do a generic replace but fix specific sheet styles later if needed.

for old, new in replacements.items():
    content = re.sub(old, new, content)

# Fix sheet and toolModal specifically
content = re.sub(r"sheet: \{\n\s*backgroundColor: 'rgba\(255,255,255,0\.05\)'", "sheet: {\n    backgroundColor: '#111318'", content)
content = re.sub(r"toolModal: \{\n\s*backgroundColor: 'rgba\(255,255,255,0\.05\)'", "toolModal: {\n    backgroundColor: '#111318'", content)

with open('SettingsScreen.tsx', 'w') as f:
    f.write(content)
