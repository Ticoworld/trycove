import os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('TRYCOVE_BROWSER_URL','http://127.0.0.1:3150')
out=Path('evidence/passport-composition');out.mkdir(parents=True,exist_ok=True)
examples=[('ccc','developer-tools'),('ickb','funding-community'),('ckbexplorer','chain-data-indexing'),('ckb-on-ramp','payments-checkout'),('grid3','unclassified')]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('TRYCOVE_CHROMIUM_PATH'))
 for width in (1440,390):
  page=b.new_page(viewport={'width':width,'height':900 if width==1440 else 844})
  for product,region in examples:
   assert page.goto(f'{base}/projects/{product}?region={region}',wait_until='networkidle').ok
   page.wait_for_timeout(400)
   assert page.locator('.passport h1').count()==1
   assert page.get_by_role('link',name='Overview',exact=True).count()==0
   assert page.get_by_text('Explore further').count()==0
   assert page.locator('.passport-visual img').count()+page.locator('.passport-illustration svg').count()==1
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
   page.screenshot(path=str(out/f'{product}-{width}.png'),full_page=True)
  page.close()
 page=b.new_page(viewport={'width':1440,'height':900})
 page.goto(f'{base}/projects/ickb?region=funding-community&view=overview',wait_until='networkidle');assert 'Funding' in page.locator('.passport-return').inner_text()
 page.get_by_role('link',name='Connections',exact=True).click();page.wait_for_url('**/*view=connections*')
 page.get_by_role('link',name='Evidence',exact=True).click();page.get_by_role('button',name='Directory and source records').click();assert page.get_by_role('dialog').is_visible();page.keyboard.press('Escape');page.get_by_role('dialog').wait_for(state='hidden')
 page.go_back();page.wait_for_url('**/*view=connections*');page.get_by_role('link',name='Back to iCKB').click();page.wait_for_url('**/projects/ickb?region=funding-community')
 page.locator('.passport-return').click();page.wait_for_url('**/map?*');assert 'project=ickb' in page.url and 'region=funding-community' in page.url
 page.close()
 page=b.new_page(viewport={'width':390,'height':844},reduced_motion='reduce');page.route('**/logos/ccc.webp',lambda route:route.abort());page.goto(f'{base}/projects/ccc',wait_until='networkidle');page.wait_for_timeout(300);assert page.locator('.passport-visual img').count()==0 and page.locator('.passport-illustration svg').is_visible();page.screenshot(path=str(out/'ccc-fallback.png'),full_page=True)
 page.close();b.close()
print('Passport composition browser checks passed')
