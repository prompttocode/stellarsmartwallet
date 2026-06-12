import re

with open('WalletConnectScreen.tsx', 'r') as f:
    content = f.read()

replacements = {
    r"backgroundColor: '#F3F4F6'": "backgroundColor: '#000000'", # screen
    r"backgroundColor: '#FFFFFF'": "backgroundColor: '#111318'", # heroCard, emptyCard, sessionCard
    r"color: '#1B1F26'": "color: '#FFFFFF'", # heroTitle
    r"color: '#7E858F'": "color: '#A1A1AA'", # heroText
    r"backgroundColor: '#F1F3F5'": "backgroundColor: '#1E232B'", # walletPill
    r"color: '#626972'": "color: '#A1A1AA'", # walletPillText
    r"backgroundColor: '#111318'": "backgroundColor: '#B8FF45'", # scanButton
    r"color: '#FFFFFF',\n    fontSize: 15,\n    fontWeight: '800'": "color: '#111318',\n    fontSize: 15,\n    fontWeight: '800'", # scanButtonText
    r"backgroundColor: '#FFF7E9'": "backgroundColor: '#2D2012'", # infoCard
    r"color: '#75501A'": "color: '#FFA933'", # infoTitle
    r"color: '#805D27'": "color: '#FFB84D'", # infoText
    r"color: '#272C33'": "color: '#FFFFFF'", # sectionTitle
    r"color: '#30353D'": "color: '#FFFFFF'", # emptyTitle, detailValue, securityTitle
    r"color: '#8B919A'": "color: '#A1A1AA'", # emptyText
    r"backgroundColor: '#F5F6F8'": "backgroundColor: '#1E232B'", # sessionDetails
    r"color: '#252A31'": "color: '#FFFFFF'", # sessionName
    r"borderColor: '#F0D5D7'": "borderColor: '#3D2527'", # disconnectButton
    r"backgroundColor: '#EDEFF2'": "backgroundColor: '#111318'", # securityCard
    r"color: '#666D76'": "color: '#A1A1AA'", # securityText
    r"backgroundColor: '#EEF0F2'": "backgroundColor: '#1E232B'", # networkBadge
    r"color: '#5D636C'": "color: '#A1A1AA'", # networkBadgeText
}

for pattern, repl in replacements.items():
    content = re.sub(pattern, repl, content)

# I also need to change the scan icon color
content = content.replace('<Ionicons color="#FFFFFF" name="qr-code-outline" size={20} />', '<Ionicons color="#111318" name="qr-code-outline" size={20} />')

with open('WalletConnectScreen.tsx', 'w') as f:
    f.write(content)

