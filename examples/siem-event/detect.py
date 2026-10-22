"""Local mapping/threshold example; not a Security Lake ingestion client."""
from datetime import datetime
import json

def normalize(raw):
    if raw.get('eventSource') != 'signin.amazonaws.com' or raw.get('eventName') != 'ConsoleLogin':
        return None
    result = raw.get('responseElements', {}).get('ConsoleLogin')
    # Unknown status must not silently become success or failure.
    if result not in ('Success', 'Failure'):
        return None
    return {
        'metadata': {'uid': raw['eventID']},
        'time': int(datetime.fromisoformat(raw['eventTime'].replace('Z', '+00:00')).timestamp()*1000),
        'class_uid': 3002, 'activity_id': 1, 'type_uid': 300201,
        'status_id': 1 if result == 'Success' else 2,
        'src_endpoint': {'ip': raw['sourceIPAddress']},
        'user': {'uid': raw['userIdentity']['principalId']},
        'cloud': {'account': {'uid': raw['recipientAccountId']}},
    }

def detect(raw_events, window_end):
    end = int(datetime.fromisoformat(window_end.replace('Z', '+00:00')).timestamp()*1000)
    groups, seen = {}, set()
    for raw in raw_events:
        event = normalize(raw)
        if event is None:
            continue
        uid = (event['cloud']['account']['uid'], event['metadata']['uid'])
        if uid in seen:
            continue
        seen.add(uid)
        if not (end - 300000 < event['time'] <= end and event['status_id'] == 2):
            continue
        key = (event['cloud']['account']['uid'], event['src_endpoint']['ip'])
        groups.setdefault(key, []).append(event['metadata']['uid'])
    return [{'rule_id': 'demo-console-failures-v1', 'account': key[0],
             'source_ip': key[1], 'window_end': window_end,
             'failed_events': len(ids), 'event_ids': sorted(ids)}
            for key, ids in sorted(groups.items()) if len(ids) >= 5]

if __name__ == '__main__':
    base = {'eventSource':'signin.amazonaws.com','eventName':'ConsoleLogin',
            'sourceIPAddress':'192.0.2.10','recipientAccountId':'111122223333',
            'userIdentity':{'principalId':'demo-user'},
            'responseElements':{'ConsoleLogin':'Failure'}}
    events = [dict(base,eventID=f'demo-{i}',eventTime=f'2026-10-22T00:0{i}:00Z') for i in range(1,6)]
    assert detect(events[:4], '2026-10-22T00:05:00Z') == []
    assert detect(events[:4]+[events[0]], '2026-10-22T00:05:00Z') == []
    assert detect(events, '2026-10-22T00:11:00Z') == []
    success = dict(events[-1],responseElements={'ConsoleLogin':'Success'})
    assert detect(events[:4]+[success], '2026-10-22T00:05:00Z') == []
    print(json.dumps({'raw':events[-1], 'ocsf_projection':normalize(events[-1]),
                      'finding':detect(events, '2026-10-22T00:05:00Z')[0]},indent=2))
