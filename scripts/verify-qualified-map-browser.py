from pathlib import Path
import os,re
from playwright.sync_api import sync_playwright
base=os.environ.get('TRYCOVE_BROWSER_URL', 'http://127.0.0.1:3150')
out=Path('evidence/data-01d')
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('TRYCOVE_CHROMIUM_PATH'))
 for width in [390,360,430,1440]:
  mobile=width<800
  page=b.new_page(viewport={'width':width,'height':1000 if not mobile else 844},has_touch=mobile,is_mobile=mobile,reduced_motion='reduce')
  assert page.goto(base+'/map',wait_until='networkidle',timeout=420000).ok
  page.wait_for_timeout(700)
  svg=page.locator('.landscape-frame svg')
  assert svg.get_attribute('viewBox')=='0 0 1100 800'
  assert page.get_by_role('group',name='Choose a problem area').get_by_role('button').count()==9
  assert page.evaluate('document.documentElement.scrollWidth === innerWidth')
  if width==390: page.screenshot(path=str(out/'mobile-world.png'))
  if width==1440: page.screenshot(path=str(out/'desktop.png'))
  landmark=page.get_by_role('button',name='Payments & Fiber, 8 projects')
  if mobile: landmark.tap(position={'x':25,'y':25})
  else: landmark.focus(); landmark.press('Enter')
  if mobile:
   page.get_by_role('button',name='View full map').wait_for()
   assert svg.get_attribute('viewBox')!='0 0 1100 800'
   if width==390: page.screenshot(path=str(out/'mobile-focused.png'))
   page.get_by_role('button',name='Next area').click()
   page.get_by_role('button',name='Previous area').click()
   page.get_by_role('button',name='View full map').click()
   assert 'region=payments-checkout&view=world' in page.url
   page.go_back(); page.get_by_role('button',name='View full map').wait_for()
   page.go_forward(); page.get_by_role('button',name='View full map').wait_for(state='hidden')
   assert svg.get_attribute('viewBox')=='0 0 1100 800'
   page.goto(base+'/map?region=payments-checkout',wait_until='networkidle')
   page.get_by_role('button',name='View full map').wait_for()
  page.get_by_role('button',name=re.compile('^CKB On-ramp')).first.click()
  page.get_by_text('Product passport · Preview',exact=True).wait_for()
  if width==390: page.screenshot(path=str(out/'mobile-project.png'),full_page=True)
  if width==1440:
   page.get_by_role('link',name='Open Product Passport').click()
   page.get_by_role('heading',name='CKB On-ramp',exact=True).wait_for(timeout=420000)
   page.get_by_text('Current availability is unknown.',exact=False).wait_for()
   page.get_by_role('link',name=re.compile('Inspect primary source')).wait_for()
   page.screenshot(path=str(out/'passport.png'))
   page.goto(base+'/map/trading-markets',timeout=420000)
   assert not page.get_by_role('link',name=re.compile('^Grid3')).count()
   page.goto(base+'/projects?q=Arweave',timeout=420000)
   page.get_by_text('No products found.',exact=False).wait_for()
   page.goto(base+'/projects?q=Grid3')
   page.get_by_role('heading',name='Grid3',exact=True).wait_for()
   assert page.goto(base+'/projects/editor-fixture').status==404
   assert page.goto(base+'/map/fixture').status==404
   page.goto(base+'/map')
   page.get_by_role('searchbox').fill('Grid3')
   page.get_by_role('button',name=re.compile('^Grid3')).first.click()
   page.get_by_text('Unmapped projects',exact=True).wait_for()
  page.close()
  print(width,'passed')
 b.close()
