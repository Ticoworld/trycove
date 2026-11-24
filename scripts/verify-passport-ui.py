import os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('TRYCOVE_BROWSER_URL','http://127.0.0.1:3150')
out=Path('evidence/passport-ui');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('TRYCOVE_CHROMIUM_PATH'))
 page=browser.new_page(viewport={'width':1440,'height':900})
 for product in ('joyid','ccc','ckbexplorer','ckb-on-ramp','grid3','ickb'):
  response=page.goto(f'{base}/projects/{product}',wait_until='networkidle');assert response.ok
  print(product,'logo',page.locator('.passport-visual img').count())
  assert page.locator('.passport h1').count()==1
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
 assert page.goto(f'{base}/projects/ickb?region=funding-community').ok
 assert 'Funding' in page.locator('.passport-return').inner_text()
 page.goto(f'{base}/projects/ickb?region=accounts-identity');assert 'Identity' not in page.locator('.passport-return').inner_text()
 page.goto(f'{base}/map?region=accounts-identity&project=joyid',wait_until='networkidle')
 page.get_by_role('link',name='Open Product Passport').click();assert 'region=accounts-identity' in page.url
 assert page.locator('.passport-visual img').evaluate('(image)=>image.complete && image.naturalWidth > 0')
 page.screenshot(path=str(out/'desktop.png'),full_page=True)
 page.get_by_role('link',name='Connections',exact=True).click();page.wait_for_url('**/*view=connections*')
 page.get_by_role('link',name='Trials',exact=True).click();page.get_by_role('heading',name='No trials on file yet').wait_for()
 page.go_back();page.wait_for_url('**/*view=connections*')
 page.get_by_role('link',name='Evidence',exact=True).click();page.get_by_role('button',name='Directory and source records').click();assert page.get_by_role('dialog').is_visible()
 assert page.get_by_role('dialog').get_by_role('link',name='Inspect primary source').get_attribute('href').startswith('https://')
 page.keyboard.press('Escape');page.get_by_role('dialog').wait_for(state='hidden')
 page.locator('.passport-return').click();page.wait_for_url('**/map?*');assert 'region=accounts-identity' in page.url and 'project=joyid' in page.url
 page.close()
 failed=browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
 failed.route('**/logos/joyid.webp',lambda route:route.abort())
 failed.goto(f'{base}/projects/joyid?region=accounts-identity',wait_until='networkidle')
 assert failed.locator('.passport-visual img').count()==0 and failed.locator('.passport-illustration svg').is_visible()
 assert failed.evaluate('document.documentElement.scrollWidth <= innerWidth')
 failed.screenshot(path=str(out/'mobile-failed-image.png'),full_page=True)
 failed.close()
 context=browser.new_context(viewport={'width':390,'height':844},record_video_dir=str(out))
 mobile=context.new_page();mobile.goto(f'{base}/map?region=developer-tools&project=ccc',wait_until='networkidle');mobile.wait_for_timeout(1200)
 mobile.get_by_role('link',name='Open Product Passport').click();mobile.wait_for_url('**/projects/ccc*');mobile.wait_for_function("() => { const image = document.querySelector('.passport-visual img'); return image && image.complete && image.naturalWidth > 0 }");mobile.wait_for_timeout(700);mobile.screenshot(path=str(out/'mobile.png'),full_page=True)
 mobile.get_by_role('link',name='Evidence',exact=True).click();mobile.wait_for_timeout(800);mobile.get_by_role('button',name='Repository associations and code').click();mobile.wait_for_timeout(1200);mobile.get_by_role('button',name='Close details').click();mobile.wait_for_timeout(600)
 video=mobile.video;context.close();video.save_as(str(out/'interaction.webm'))
 browser.close()
print('Passport browser checks passed')
