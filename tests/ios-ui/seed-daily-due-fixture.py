"""Stage only a synthetic guest idiom in a dedicated, disposable Lucid QA app.

Run after testDailyDiscoveryAndReturn. Never accepts the shipping bundle and
never changes the OS clock, production accounts, credentials or network settings.
"""
import argparse
import datetime
import json
from pathlib import Path
import subprocess
import uuid

parser = argparse.ArgumentParser()
parser.add_argument('--simulator', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
simulator = str(uuid.UUID(args.simulator)).upper()
bundle = 'com.sunilnjc.lucid.uiqa'
repo = Path(__file__).resolve().parents[2]
output = Path(args.output).resolve()
assert output.is_relative_to(repo / '.build'), 'Put QA output inside the ignored .build directory'
devices = json.loads(subprocess.check_output(['xcrun', 'simctl', 'list', 'devices', 'available', '-j'], text=True))
match = [item for values in devices['devices'].values() for item in values if item['udid'] == simulator]
assert len(match) == 1 and match[0]['name'].startswith('Lucid Daily Discovery QA'), 'Use a dedicated daily QA simulator'
assert match[0]['state'] == 'Booted', 'Boot only the dedicated QA simulator first'
subprocess.run(['xcrun', 'simctl', 'terminate', simulator, bundle], check=False, capture_output=True)
container = Path(subprocess.check_output(['xcrun', 'simctl', 'get_app_container', simulator, bundle, 'data'], text=True).strip()).resolve()
expected = Path('/Users/Sunil/Library/Developer/CoreSimulator/Devices') / simulator / 'data/Containers/Data/Application'
assert container.is_relative_to(expected.resolve()), 'Unexpected QA container'
file = container / 'Library/Application Support/Lucid/learner-guest.json'
state = json.loads(file.read_text())
learner = state['learner']
assert state['version'] == 2 and learner['profile']['roleId'] == 'finance-accounting'
assert not learner.get('displayName'), 'This fixture is for the nameless synthetic guest only'
local = learner['dailyVocabulary']
assert local['version'] == 1 and len(local['idiomReviews']) == 1, 'Run the first guest journey before this fixture'
day = max(local['idiomsByDay'])
idiom = local['idiomsByDay'][day]
assert idiom in local['idiomReviews']
assert local['idiomPractice'][f'{day}:{idiom}']['draft'] == 'A fictional plain-English explanation before guidance.', 'Unexpected private data: use the synthetic daily journey'
prior = (datetime.date.fromisoformat(day) - datetime.timedelta(days=1)).isoformat()
output.mkdir(parents=True, exist_ok=True)
(output / 'synthetic-guest-before-due.json').write_text(json.dumps(state, indent=2))
local['idiomReviews'][idiom] = {'introducedOn': prior, 'intervalIndex': 0, 'nextReviewOn': day, 'reviewCount': 0}
local['idiomPractice'].pop(f'{day}:{idiom}', None)
file.write_text(json.dumps(state))
evidence = {'qaBundle': bundle, 'simulator': simulator, 'idiomId': idiom, 'learningDay': day, 'introducedOn': prior, 'method': 'Only the synthetic QA guest record changed; OS clock and production data unchanged.'}
(output / 'due-fixture.json').write_text(json.dumps(evidence, indent=2))
print(json.dumps(evidence))
