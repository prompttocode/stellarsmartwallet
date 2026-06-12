with open('RampScreen.tsx', 'r') as f:
    content = f.read()

replacements = {
    r"backgroundColor: '#F1F3F4'": "backgroundColor: 'rgba(255,255,255,0.1)'",
    r"backgroundColor: '#D5DBDE'": "backgroundColor: 'rgba(255,255,255,0.2)'",
    r"color: '#849097'": "color: '#A1B0C8'",
    r"color: '#142129'": "color: '#FFFFFF'",
    r"backgroundColor: '#F4F7F8'": "backgroundColor: '#1E222B'",
    r"borderColor: '#E0E7EA'": "borderColor: 'rgba(255,255,255,0.1)'",
    r"backgroundColor: '#EAF0F2'": "backgroundColor: '#282C35'",
    r"backgroundColor: '#FFFFFF', // remoteQrCard": "backgroundColor: 'rgba(255,255,255,0.05)',",
    r"borderColor: '#DFE9ED'": "borderColor: 'rgba(255,255,255,0.1)'",
    r"backgroundColor: '#FFF7E8'": "backgroundColor: 'rgba(255, 165, 0, 0.1)'",
    r"color: '#855114'": "color: '#FFA500'",
    r"borderColor: '#D9E7EC'": "borderColor: 'rgba(184, 255, 69, 0.2)'",
    r"color: '#111318'": "color: '#FFFFFF'",
    r"backgroundColor: '#F5F6F8'": "backgroundColor: 'rgba(255,255,255,0.03)'",
    r"color: '#7B818A'": "color: '#A1B0C8'",
    r"backgroundColor: '#F0F1F3'": "backgroundColor: 'rgba(255,255,255,0.1)'",
    r"backgroundColor: '#FBECEE'": "backgroundColor: 'rgba(255,82,82,0.15)'",
    r"backgroundColor: '#E9F7F0'": "backgroundColor: 'rgba(184, 255, 69, 0.15)'",
    r"backgroundColor: '#FFFFFF'": "backgroundColor: '#111318'", # resultModal etc
    r"backgroundColor: '#F3F4F6'": "backgroundColor: 'rgba(255,255,255,0.05)'",
    r"color: '#262A30'": "color: '#FFFFFF'",
    r"color: '#8A9099'": "color: '#A1B0C8'",
    r"backgroundColor: '#101318'": "backgroundColor: '#B8FF45'",
    r"color: '#FFFFFF'": "color: '#000000'", # this is tricky, could overwrite previous. I'll do it manually.
    r"backgroundColor: '#F2F3F5'": "backgroundColor: 'rgba(255,255,255,0.1)'",
    r"color: '#30343B'": "color: '#FFFFFF'",
    r"color: '#737982'": "color: '#A1B0C8'",
    r"color: '#15181D'": "color: '#FFFFFF'",
    r"color: '#7E909A'": "color: '#A1B0C8'",
    r"backgroundColor: '#E7F9F1'": "backgroundColor: 'rgba(184, 255, 69, 0.15)'",
    r"backgroundColor: '#F4F8FF'": "backgroundColor: 'rgba(255, 255, 255, 0.05)'",
    r"borderColor: '#DDE8FF'": "borderColor: 'rgba(255,255,255,0.1)'",
    r"color: '#71839B'": "color: '#A1B0C8'",
}

# Apply safely to the styles block
start_idx = content.find('const styles = StyleSheet.create({')
styles_block = content[start_idx:]

for old, new in replacements.items():
    if "color: '#FFFFFF'" in old: continue # skip to avoid messing up
    styles_block = styles_block.replace(old, new)

# manual fixes for primary action
styles_block = styles_block.replace("resultPrimaryActionText: {\n    color: '#FFFFFF',", "resultPrimaryActionText: {\n    color: '#000000',")
styles_block = styles_block.replace("resultModal: {\n    backgroundColor: '#FFFFFF',", "resultModal: {\n    backgroundColor: '#111318',")
styles_block = styles_block.replace("remoteQrCard: {\n    alignItems: 'center',\n    backgroundColor: '#FFFFFF',", "remoteQrCard: {\n    alignItems: 'center',\n    backgroundColor: 'rgba(255,255,255,0.05)',")

content = content[:start_idx] + styles_block

with open('RampScreen.tsx', 'w') as f:
    f.write(content)
