"""Exercise explicitly labeled fixture records in an isolated local preview only."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('TRYCOVE_FIXTURE_URL')
if not base or not (base.startswith('http://127.0.0.1:') or base.startswith('http://localhost:')):
 raise SystemExit('Set TRYCOVE_FIXTURE_URL to the isolated local test-fixture server.')
out=Path(os.environ.get('TRYCOVE_EVIDENCE_DIR','.data/connections-check'));out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('TRYCOVE_CHROMIUM_PATH'))
 for width in (1440,390):
  c=b.new_context(viewport={'width':width,'height':900 if width==1440 else 844},reduced_motion='reduce' if width==390 else 'no-preference',record_video_dir=str(out) if width==1440 else None)
  q=c.new_page();q.goto(base+'/opportunities',wait_until='networkidle');assert q.locator('.connection-row').count()==4;assert q.get_by_text('Test fixture:',exact=False).count()>=4;assert q.evaluate('document.documentElement.scrollWidth <= innerWidth');q.screenshot(path=str(out/f'fixture-board-{width}.png'),full_page=True)
  q.get_by_role('searchbox',name='Search opportunities').fill('onboarding');q.get_by_role('button',name='Search',exact=True).click();q.wait_for_url('**/*q=onboarding*');assert q.locator('.connection-row').count()==1;q.get_by_role('link',name='All',exact=True).click() if q.get_by_role('link',name='All',exact=True).count() else q.goto(base+'/opportunities',wait_until='networkidle');q.goto(base+'/opportunities',wait_until='networkidle');q.get_by_role('link',name='Potential connections').click();q.wait_for_url('**/*type=potential*');assert q.locator('.connection-row').count()==1
  q.get_by_role('link',name='Explore opportunity').click();q.wait_for_url('**/opportunities/fixture-potential');q.wait_for_timeout(1000);assert q.get_by_role('heading',name='Test fixture: explore a wallet connection for an application toolkit.').is_visible();assert q.get_by_role('link',name='View CCC').is_visible();q.screenshot(path=str(out/f'fixture-opportunity-{width}.png'),full_page=True)
  q.get_by_role('link',name='Evidence',exact=True).click();q.wait_for_url('**/*view=records');q.get_by_role('button',name='Source 1').click();assert q.get_by_role('dialog').is_visible();assert q.get_by_text('Test fixture: this is a fabricated source statement used only to test the interface.').is_visible();q.wait_for_timeout(700);q.keyboard.press('Escape');q.get_by_role('dialog').wait_for(state='hidden')
  q.get_by_role('link',name='Reviews',exact=True).click();q.wait_for_url('**/*view=reviews');assert q.get_by_text('Engine assessment').is_visible()
  q.get_by_role('link',name='Follow-through',exact=True).click();q.wait_for_url('**/*view=follow-up');assert q.get_by_text('Follow-up ledger',exact=False).is_visible();assert q.get_by_role('button',name='Add to ledger').count()==0
  q.go_back();q.wait_for_url('**/*view=reviews');q.goto(base+'/opportunities/fixture-need',wait_until='networkidle');assert q.get_by_text('Open to a match').is_visible();assert q.locator('.connection-identity img').count()==0
  q.goto(base+'/opportunities/fixture-trial',wait_until='networkidle');assert q.get_by_text('trial record available',exact=False).count()>0;assert 'fixture result' in q.locator('body').inner_text() or q.get_by_role('link',name='Follow-through',exact=True).is_visible()
  if width==1440: video=q.video
  c.close()
  if width==1440:video.save_as(str(out/'fixture-interaction.webm'))
 fail=b.new_page();fail.route('**/logos/ccc.webp',lambda route:route.abort());fail.goto(base+'/opportunities/fixture-potential',wait_until='networkidle');assert fail.locator('.connection-identity').first.locator('img').count()==0;assert fail.locator('.connection-identity').first.locator('svg').count()==1;fail.close()
 b.close()
print('Explicitly labeled fixture checks passed')
