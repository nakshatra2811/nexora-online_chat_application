import re

path = r"D:\Nexora 1.0 ANTI\client\src\app\dashboard\chats\page.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Track changes
changes = []

# 1. selectedThread.color -> selectedThread?.color || 'from-gray-700 to-gray-900'
content_new = content.replace(
    "${selectedThread.color}",
    "${selectedThread?.color || 'from-gray-700 to-gray-900'}"
)
if content_new != content:
    changes.append("Fixed selectedThread.color")
content = content_new

# 2. selectedThread.name[0] -> selectedThread?.name?.[0] || '?'
content_new = content.replace(
    "{selectedThread.name[0]}",
    "{selectedThread?.name?.[0] || '?'}"
)
if content_new != content:
    changes.append("Fixed selectedThread.name[0]")
content = content_new

# 3. selectedThread.name} -> selectedThread?.name}   (plain .name in JSX text nodes)
content_new = re.sub(
    r'\{selectedThread\.name\}',
    '{selectedThread?.name}',
    content
)
if content_new != content:
    changes.append("Fixed {selectedThread.name}")
content = content_new

# 4. selectedThread.online  
content_new = content.replace(
    "selectedThread.online",
    "selectedThread?.online"
)
if content_new != content:
    changes.append("Fixed selectedThread.online")
content = content_new

# 5. selectedThread.id (in conditional checks) - only outside Optional chains already done
# Be careful - only fix bare .id references
content_new = re.sub(
    r'selectedThread\.id(?!\s*===\s*null)',
    'selectedThread?.id',
    content
)
if content_new != content:
    changes.append("Fixed selectedThread.id bare")
content = content_new

# 6. user.color -> user?.color
content_new = re.sub(
    r'\$\{user\.color\}',
    "${user?.color || 'from-gray-700 to-gray-900'}",
    content
)
if content_new != content:
    changes.append("Fixed user.color")
content = content_new

# 7. user.name[0] -> user?.name?.[0]
content_new = content.replace(
    "{user.name[0]}",
    "{user?.name?.[0]}"
)
if content_new != content:
    changes.append("Fixed user.name[0]")
content = content_new

# 8. user.name.split -> user?.name?.split
content_new = content.replace(
    "user.name.split",
    "user?.name?.split"
)
if content_new != content:
    changes.append("Fixed user.name.split")
content = content_new

# 9. contact.color -> contact?.color || fallback
content_new = re.sub(
    r'\$\{msg\.contact\.color\}',
    "${msg.contact?.color || 'from-gray-700 to-gray-900'}",
    content
)
if content_new != content:
    changes.append("Fixed msg.contact.color")
content = content_new

# 10. msg.contact.name[0] -> msg.contact?.name?.[0]
content_new = content.replace(
    "{msg.contact.name[0]}",
    "{msg.contact?.name?.[0] || '?'}"
)
if content_new != content:
    changes.append("Fixed msg.contact.name[0]")
content = content_new

# 11. contact.color (in contact picker MOCK_CONTACTS map)
content_new = re.sub(
    r'\$\{contact\.color\}',
    "${contact?.color || 'from-gray-700 to-gray-900'}",
    content
)
if content_new != content:
    changes.append("Fixed contact.color (picker)")
content = content_new

# 12. contact.name[0] in picker
content_new = content.replace(
    "{contact.name[0]}",
    "{contact?.name?.[0] || '?'}"
)
if content_new != content:
    changes.append("Fixed contact.name[0] (picker)")
content = content_new

# 13. Remove SpecialAtithi / Authorized Node filter
content_new = content.replace(
    '.filter(t => userRole === "Authorized Node" || !t.name.includes("Clearance"))',
    '.filter(t => !t.name.includes("Clearance"))'
)
if content_new != content:
    changes.append("Removed SpecialAtithi/Authorized Node filter")
content = content_new

# 14. Requests link in empty state - comment out
old_btn = '''          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => window.location.href = '/dashboard/requests'}
            className="px-6 py-3 rounded-xl text-sm font-bold text-white shadow-lg"
            style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}>
            View Network Requests
          </motion.button>'''
new_btn = '          {/* requests button removed */}'
if old_btn in content:
    content = content.replace(old_btn, new_btn)
    changes.append("Commented out Requests button")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done! Changes made:")
for c in changes:
    print(" -", c)
if not changes:
    print("  (no changes - patterns may already be fixed)")
