import type { FeedItem } from '../../types'
import { placeById } from '../geo'

// Mock social posts (X-style) tied to seeded places.

// [placeId, handle, text, minutesAgo]
const SAMPLE: [string, string, string, number][] = [
  ['congress-bridge', 'batwatch_atx', 'Statesman lawn filling up already. Bring a blanket, the bats are punctual tonight 🦇', 6],
  ['congress-bridge', 'kayak_ladybird', 'Paddling under the bridge for the emergence — the smell is part of the experience lol', 22],
  ['zilker', 'zilker_dogs', 'Great Lawn is pure golden retriever energy right now. 10/10 vibes', 14],
  ['zilker', 'atxrunclub', 'Butler Trail loop done before sunset. Breeze finally feels like fall', 41],
  ['barton-springs', 'springsdaily', 'Water is 68° as always. Air is warm. Perfect evening dip conditions', 33],
  ['moody-center', 'hornsfan_kyle', 'Merch line at Moody is already wrapping around the building 😅', 18],
  ['acl-live', 'acltv_fan', 'Got the ACL taping lottery!! Can\'t believe it', 55],
  ['stubbs', 'redriverregular', "Stubb's outdoor stage + brisket + cool night = Austin at its best", 27],
  ['mohawk', 'mohawk_rooftop', 'Rooftop is open, openers just started. Come early, it fills up', 9],
  ['sixth-street', 'sixthstreetsounds', 'Blues jam at the corner bar is unreal tonight. Free cover till 10', 12],
  ['sixth-street', 'atx_nightowl', 'Pedestrian closure on E 6th kicks in soon — rideshare pickup is on 7th', 37],
  ['rainey', 'raineyregular', 'Every bungalow on Rainey has a line, but the taco truck behind the corner bar has none', 24],
  ['capitol', 'capitolview_atx', 'Capitol dome glowing pink at sunset. Never gets old', 48],
  ['q2', 'verdeforever', 'Already counting down to the next Q2 match. Listos! 💚🖤', 72],
  ['dkr', 'forty_acres', 'DKR lights on for practice. Saturday can\'t come soon enough 🤘', 63],
  ['franklin', 'bbqline_report', 'Franklin line report: ~40 people at 8:15am. Lawn chairs out. Worth it', 180],
  ['south-congress', 'soco_strolls', 'Line at the "i love you so much" wall is short right now if you want the pic', 16],
  ['south-congress', 'tacotuesday_atx', 'Breakfast taco count today: 4. No regrets', 95],
  ['mount-bonnell', 'hillcountryhikes', 'Mount Bonnell steps at golden hour 🌅 Lake Austin looking like glass', 29],
]

export function mockSocial(now = Date.now()): FeedItem[] {
  // Round to 5 min so items don't jitter on every refresh.
  const anchor = Math.floor(now / 300_000) * 300_000
  return SAMPLE.map(([placeId, handle, text, mins], i) => {
    const place = placeById(placeId)
    return {
      id: `soc-sample-${i}`,
      kind: 'social' as const,
      tab: 'social' as const,
      placeId,
      title: text,
      subtitle: `@${handle}`,
      time: new Date(anchor - mins * 60_000).toISOString(),
      lat: place?.lat,
      lng: place?.lng,
      source: 'X',
    }
  })
}
