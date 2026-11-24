import os
from playwright.sync_api import sync_playwright
base=os.environ.get('TRYCOVE_BROWSER_URL','http://127.0.0.1:3150')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('TRYCOVE_CHROMIUM_PATH'))
 for w,h in [(1920,900),(1200,800),(390,844)]:
  page=b.new_page(viewport={'width':w,'height':h},reduced_motion='reduce')
  page.goto(base+'/projects/ckbexplorer?region=chain-data-indexing',wait_until='networkidle')
  main=page.locator('main.shell').bounding_box();print(w,'margin',main['x'],'width',main['width']);assert main['x'] <= 50 and page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  page.get_by_role('link',name='Trials',exact=True).click();page.wait_for_url('**/*view=trials*');assert page.get_by_role('heading',name='No trials on file yet').is_visible();assert page.get_by_role('link',name='Explore Trial Rooms').is_visible();assert page.get_by_text('Back to CKB Explorer').count()==0
  page.get_by_role('link',name='Evidence',exact=True).click();page.get_by_role('button',name='Directory and source records').wait_for();assert page.locator('.passport-evidence-button').count()==5
  page.get_by_role('button',name='Directory and source records').click();assert page.get_by_role('dialog').is_visible();assert page.get_by_role('link',name='Inspect primary source').is_visible();page.keyboard.press('Escape');page.get_by_role('dialog').wait_for(state='hidden')
  page.go_back();page.wait_for_url('**/*view=trials*');page.close()
 b.close()
print('Passport layout and destination checks passed')
