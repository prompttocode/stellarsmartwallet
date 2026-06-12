import re

with open('FaucetScreen.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { useSafeScreenInsetStyle", "import { useSafeAreaInsets } from 'react-native-safe-area-context';\nimport { useSafeScreenInsetStyle")

start_idx = content.find("  return (\n    <ScrollView")

if start_idx != -1:
    before = content[:start_idx]
    
    if "const insets = useSafeAreaInsets();" not in before:
        before = before.replace("const screenInsetStyle = useSafeScreenInsetStyle();", "const screenInsetStyle = useSafeScreenInsetStyle();\n  const insets = useSafeAreaInsets();")

    after_return = content[start_idx:]
    
    header_regex = re.compile(r'<ModernScreenHeader\n[^>]+/>\n', re.MULTILINE)
    match = header_regex.search(after_return)
    if match:
        header_text = match.group(0)
        title_match = re.search(r'title={([^}]+)}', header_text)
        subtitle_match = re.search(r'subtitle={([\s\S]+?)}', header_text)
        
        if not title_match:
            title_match = re.search(r'title="([^"]+)"', header_text)
            title_val = f'"{title_match.group(1)}"'
        else:
            title_val = title_match.group(1)
            
        subtitle_val = subtitle_match.group(1)
        
        hero_replacement = """
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <PressScale onPress={onBack} style={styles.heroBackButton}>
            <Ionicons color="#FFFFFF" name="chevron-back" size={24} />
          </PressScale>
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900' }}>Funding</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.heroEyebrow}>STELLAR WALLET</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '900', letterSpacing: -0.4, marginTop: 8 }}>
          {""" + title_val + """}
        </Text>
        <Text style={styles.heroSubtitle}>{""" + subtitle_val + """}</Text>
      </View>
"""
        after_return = after_return.replace(header_text, hero_replacement)

    styles_add = """
  root: {
    backgroundColor: '#F4F5F7',
  },
  content: {
    backgroundColor: '#F4F5F7',
  },
  hero: {
    backgroundColor: '#071421',
    paddingBottom: 72,
    paddingHorizontal: 18,
  },
  heroBackButton: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginTop: 24,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 320,
  },
  receiptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    marginHorizontal: 16,
    marginTop: -48,
    padding: 20,
    shadowColor: '#071421',
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
  },
  receiptCardBottom: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
  },
"""
    after_return = after_return.replace("const styles = StyleSheet.create({", "const styles = StyleSheet.create({" + styles_add)

    after_return = after_return.replace("contentContainerStyle={screenInsetStyle}", "contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}\n      style={styles.root}")
    
    after_return = after_return.replace("modern.sectionCard", "styles.receiptCardBottom")
    after_return = after_return.replace("styles.receiptCardBottom, styles.heroCard", "styles.receiptCard, styles.heroCard")
    
    after_return = after_return.replace("modern.primaryModernButton", "styles.primaryButton")
    after_return = after_return.replace("modern.modernButtonText", "styles.primaryButtonText")
    after_return = after_return.replace("modern.secondaryModernButton", "styles.secondaryButton")
    after_return = after_return.replace("modern.secondaryModernButtonText", "styles.secondaryButtonText")
    
    btn_styles = """
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#B8FF45',
    borderRadius: 28,
    justifyContent: 'center',
    minHeight: 58,
  },
  primaryButtonText: {
    color: '#071421',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 28,
    justifyContent: 'center',
    minHeight: 58,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
  },
"""
    after_return = after_return.replace("const styles = StyleSheet.create({", "const styles = StyleSheet.create({" + btn_styles)
    
    after_return = after_return.replace("modern.assetModernBody", "styles.assetBodyLocal")
    after_return = after_return.replace("modern.assetModernName", "styles.assetNameLocal")
    after_return = after_return.replace("modern.assetModernMeta", "styles.assetMetaLocal")
    after_return = after_return.replace("modern.assetAddButton", "styles.enableButton")
    after_return = after_return.replace("modern.assetFaucetButton", "styles.faucetButton")
    after_return = after_return.replace("modern.assetButtonText", "styles.assetButtonText")
    
    btn_styles_2 = """
  assetBodyLocal: { flex: 1, gap: 3 },
  assetNameLocal: { color: '#111827', fontSize: 15, fontWeight: '900' },
  assetMetaLocal: { color: '#7D8795', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  enableButton: { alignItems: 'center', backgroundColor: '#111827', borderRadius: 17, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 9 },
  faucetButton: { alignItems: 'center', backgroundColor: '#EEF4FF', borderRadius: 17, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 9 },
  assetButtonText: { color: '#111827', fontSize: 12, fontWeight: '900' },
"""
    after_return = after_return.replace("const styles = StyleSheet.create({", "const styles = StyleSheet.create({" + btn_styles_2)
    
    after_return = after_return.replace("<SectionHeader title=", '<Text style={styles.localSectionTitle}>{')
    after_return = after_return.replace('/>\n        <View style={styles.addressCopy}>', '}</Text>\n        <View style={styles.addressCopy}>')
    after_return = after_return.replace('/>\n        {assets.map', '}</Text>\n        {assets.map')
    
    after_return = after_return.replace("const styles = StyleSheet.create({", "const styles = StyleSheet.create({\n  localSectionTitle: { color: '#111827', fontSize: 18, fontWeight: '900', marginBottom: 12 },")

    with open('FaucetScreen.tsx', 'w') as f:
        f.write(before + after_return)

