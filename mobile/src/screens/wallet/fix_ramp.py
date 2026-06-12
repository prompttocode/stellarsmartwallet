import re

with open('RampScreen.tsx', 'r') as f:
    content = f.read()

# Add style={{ backgroundColor: '#000000' }} to main ScrollViews
content = content.replace("<ScrollView\n          contentContainerStyle={screenInsetStyle}", "<ScrollView\n          contentContainerStyle={screenInsetStyle}\n          style={{ backgroundColor: '#000000' }}")
content = content.replace("<ScrollView\n        contentContainerStyle={screenInsetStyle}", "<ScrollView\n        contentContainerStyle={screenInsetStyle}\n        style={{ backgroundColor: '#000000' }}")

# Replace colors in styles
replacements = {
    r"backgroundColor: '#F5F6F8'": "backgroundColor: '#000000'", # orderScreen
    r"backgroundColor: '#F4F8FA'": "backgroundColor: '#1E232B'", # assetChoice, bankList
    r"borderColor: '#E2EBEF'": "borderColor: '#2A303A'",
    r"color: '#A1B0C8'": "color: '#8A9099'",
    r"color: '#344054'": "color: '#FFFFFF'",
    r"backgroundColor: 'rgba\(184, 255, 69, 0.15\)'": "backgroundColor: 'rgba(184, 255, 69, 0.15)'",
    r"borderColor: '#0ABF73'": "borderColor: '#B8FF45'",
    r"backgroundColor: '#FFFFFF'": "backgroundColor: '#111318'", # resultModal, picker header
    r"color: '#172033'": "color: '#FFFFFF'",
    r"color: '#6B7280'": "color: '#A1A1AA'",
    r"backgroundColor: '#F9FAFB'": "backgroundColor: '#1C1C1E'",
    r"color: '#071421'": "color: '#FFFFFF'",
    r"color: '#111827'": "color: '#FFFFFF'",
    r"borderColor: '#ECEFF3'": "borderColor: '#2A303A'",
    r"backgroundColor: '#FFF5E7'": "backgroundColor: '#2D2012'", # feeWarning
    r"color: '#A86200'": "color: '#FFA933'", # feeWarningText
    r"backgroundColor: '#F0F9FF'": "backgroundColor: '#0A2540'", # testPaymentBox
    r"color: '#026AA2'": "color: '#33A8FF'", # testPaymentTitle
    r"color: '#004B7A'": "color: '#7AC4FF'", # testPaymentText
}

for pattern, repl in replacements.items():
    content = re.sub(pattern, repl, content)

# bankOptionCopy is probably fine, but bankName and bankBin might need fixing
# bankOptionName
content = content.replace("color: '#101828'", "color: '#FFFFFF'")
content = content.replace("color: '#667085'", "color: '#A1A1AA'")
content = content.replace("color: '#344054'", "color: '#FFFFFF'")

with open('RampScreen.tsx', 'w') as f:
    f.write(content)

