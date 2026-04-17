import http.cookiejar, urllib.request, urllib.parse, json, sys
sys.stdout.reconfigure(encoding='utf-8')
BASE='http://localhost:3000'
cj=http.cookiejar.CookieJar()
op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
csrf=json.loads(op.open(f'{BASE}/api/auth/csrf').read())['csrfToken']
op.open(f'{BASE}/api/auth/callback/credentials', data=urllib.parse.urlencode({'email':'admin@cre.ae','password':'admin123','csrfToken':csrf,'redirect':'false','json':'true'}).encode()).read()
def api(m,p,b=None):
    r=urllib.request.Request(f'{BASE}{p}',method=m)
    if b: r.add_header('Content-Type','application/json'); r.data=json.dumps(b).encode()
    try: return json.loads(op.open(r).read())
    except urllib.error.HTTPError as e: return {'__error__':e.code,'msg':e.read().decode(errors='replace')[:200]}

o = api('POST','/api/owners',{'ownerName':'Khalifa Zayed Al Nehayan','email':'k@cre.ae','buildingName':'Oasis Tower','buildingType':'Residential','area':'Trade Center Second','plotNo':'7-0','makaniNo':'12345 67890'})
oid = o['id']
api('POST','/api/units/bulk',{'floors':1,'unitsPerFloor':1,'unitType':'Studio','currentRent':65000})
units = api('GET','/api/units')
uid = units[0]['id']
t = api('POST','/api/tenants',{'name':'Maryna Talyhina','email':'m@cre.ae','phone':'+971 50 451 7399','emiratesId':'784-1996-3988434-7','familySize':1})
tid = t['id']
tc = api('POST', f'/api/tenants/{tid}/tenancy-contracts', {
    'unitId':uid, 'ownerId':oid,
    'contractStart':'2026-05-01', 'contractEnd':'2027-04-30',
    'rentAmount':65000, 'numberOfCheques':4, 'securityDeposit':3250,
    'contractType':'Residential', 'reason':'Initial'
})
contract = tc.get('contract', tc) if isinstance(tc, dict) else tc
cid = contract['id']

# Save the HTML to file so user can open it
html = op.open(f'{BASE}/api/tenancy-contracts/{cid}?format=html').read().decode()
with open(r'C:\Projects\property-pms\sample-contract.html','w',encoding='utf-8') as f:
    f.write(html)
print(f'Sample contract saved: {len(html)} bytes')
print(f'Open in browser: file:///C:/Projects/property-pms/sample-contract.html')
print(f'Or: http://localhost:3000/api/tenancy-contracts/{cid}?format=html')
print(f'\nContract ID: {cid}')
print(f'Owner ID: {oid}')
print(f'Tenant ID: {tid}')
print('(Not deleted — open in browser to inspect, then I will clean up)')
