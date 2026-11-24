"""Browser regression for the sticky map inspector against a running preview."""
import os
from playwright.sync_api import sync_playwright

base = os.environ.get('TRYCOVE_BROWSER_URL', 'http://127.0.0.1:3150')
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=os.environ.get('TRYCOVE_CHROMIUM_PATH'))
    for width, height in [(1440, 900), (1200, 600)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        assert page.goto(base + '/map', wait_until='networkidle').ok
        cross = page.locator('.landscape-frame .map-place[data-kind="8"]')
        cross.scroll_into_view_if_needed()
        before = page.evaluate('scrollY')
        cross.click()
        page.wait_for_timeout(450)
        assert abs(page.evaluate('scrollY') - before) < 2
        panel = page.locator('.map-panel')
        assert 360 <= panel.bounding_box()['width'] <= 480
        assert 0 <= panel.bounding_box()['y'] <= 16
        page.locator('.landscape-frame .map-place[data-kind="6"]').click()
        assert page.get_by_role('heading', name='Contract & Transaction Safety').is_visible()
        assert 0 <= panel.bounding_box()['y'] <= 16
        page.locator('.landscape-frame .map-place[data-kind="3"]').click()
        page.wait_for_timeout(200)
        assert page.locator('.project-row').count() > 10
        panel.evaluate('(element) => element.scrollTop = element.scrollHeight')
        heading = page.locator('.map-district-heading')
        assert heading.is_visible() and page.locator('.map-close').is_visible()
        assert 0 <= heading.bounding_box()['y'] < 100
        assert '22 projects' in heading.inner_text()
        assert page.locator('.map-list').evaluate('(el) => el.scrollHeight <= el.clientHeight')
        page.close()
    page = browser.new_page(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
    page.goto(base + '/map', wait_until='networkidle')
    page.locator('.landscape-frame .map-place[data-kind="0"]').click()
    page.get_by_role('button', name='Explore Payments projects').click()
    assert page.get_by_role('heading', name='Payments & Fiber').is_visible()
    assert 0 <= page.locator('.map-district-heading').bounding_box()['y'] < 844
    page.close()
    browser.close()
print('Sticky inspector browser checks passed')
