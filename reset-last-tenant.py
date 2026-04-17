"""
Reset the most recently created tenant back to pre-signing state so you can
re-upload the EID + re-sign using the same email link, without creating a
new tenant each time.

Usage:
    python reset-last-tenant.py
"""
import http.cookiejar, urllib.request, urllib.parse, json, sys
sys.stdout.reconfigure(encoding='utf-8')
BASE = 'http://localhost:3000'
cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

# Log in as admin
csrf = json.loads(op.open(f'{BASE}/api/auth/csrf').read())['csrfToken']
op.open(f'{BASE}/api/auth/callback/credentials', data=urllib.parse.urlencode({
    'email': 'admin@cre.ae', 'password': 'admin123',
    'csrfToken': csrf, 'redirect': 'false', 'json': 'true'
}).encode()).read()

tenants = json.loads(op.open(f'{BASE}/api/tenants').read())
if not tenants:
    print('No tenants found.'); sys.exit(1)

# Sort by createdAt desc, pick most recent
tenants.sort(key=lambda t: t.get('createdAt', ''), reverse=True)
t = tenants[0]
tid = t['id']
print(f'Resetting tenant: {t["name"]} ({t["email"]})')

# Get latest contract
contracts = json.loads(op.open(f'{BASE}/api/tenants/{tid}/tenancy-contracts').read())['contracts']
if not contracts:
    print('No contracts for this tenant.'); sys.exit(1)

c = contracts[0]
print(f'Latest contract: {c["contractNo"]} v{c["version"]} – status: {c["status"]}')
print(f'\nSign link: {BASE}/sign/{c["signatureToken"]}')
print('\nOpen this link in your browser and re-upload the EID front + back.')
print('The server will run OCR with the new retry logic.')
print('\nTip: tail the dev-server log to watch OCR progress:')
print('  grep eid-ocr <dev-log-file>')
