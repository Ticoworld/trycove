from pathlib import Path
import os
from playwright.sync_api import sync_playwright
base=os.environ.get('TRYCOVE_BROWSER_URL', 'http://127.0.0.1:3150')+'/map'
out=Path('evidence/living-atlas')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('TRYCOVE_CHROMIUM_PATH'))
 for width in (1440,390,360,430):
  mobile=width<800
  ctx=b.new_context(viewport={'width':width,'height':900 if not mobile else 844},record_video_dir=str(out) if width in (1440,390) else None, reduced_motion='reduce' if width==360 else 'no-preference')
  page=ctx.new_page(); response=page.goto(base,wait_until='networkidle'); assert response.ok
  places=page.locator('.map-place'); assert places.count()==9
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  if mobile:
   places.first.click(force=True); page.wait_for_timeout(500)
   assert page.get_by_role('button',name='View full map').is_visible()
   page.locator('.project-row').first.click(); assert page.get_by_text('Product passport · Preview').is_visible()
   page.get_by_role('button',name='View full map').click(); assert 'view=world' in page.url and 'project=' in page.url
   page.go_back(); assert page.get_by_role('button',name='View full map').is_visible()
   page.go_forward(); assert 'view=world' in page.url
   page.goto(base,wait_until='networkidle')
  else:
   for i in range(9):
    places.nth(i).click(force=True); page.wait_for_timeout(450)
    assert places.nth(i).get_attribute('aria-pressed')=='true'
    assert page.locator('.map-panel').is_visible()
   for i in (0,4,5,1,0): places.nth(i).click(force=True)
   places.first.focus(); page.keyboard.press('Enter'); assert places.first.get_attribute('aria-pressed')=='true'
   page.locator('.project-row').first.click(); assert page.get_by_role('link',name='Open Product Passport').is_visible()
   page.go_back(); assert page.locator('.project-row').count()>0
   page.locator('#world-search').fill('Grid3'); page.get_by_role('button',name='Grid3',exact=False).first.click(); assert page.get_by_text('Product passport · Preview').is_visible()
   page.goto(base+'?region=developer-tools',wait_until='networkidle'); assert page.locator('.map-place.selected').count()==1
  page.wait_for_timeout(500)
  video=page.video
  ctx.close()
  if video: video.save_as(str(out/('desktop.webm' if not mobile else 'mobile.webm')))
  print(width,'passed')
 b.close()
