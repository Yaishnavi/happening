import type { Category, Place } from '../types'

export const AUSTIN_CENTER: [number, number] = [-97.7431, 30.2672]

export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  music: { label: 'Music', color: '#8b5cf6' },
  outdoors: { label: 'Outdoors', color: '#10b981' },
  food: { label: 'Food & Drink', color: '#f59e0b' },
  landmark: { label: 'Landmarks', color: '#3b82f6' },
  sports: { label: 'Sports', color: '#ef4444' },
  nightlife: { label: 'Nightlife', color: '#ec4899' },
}

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=70`

export const PLACES: Place[] = [
  { id: 'congress-bridge', name: 'Congress Ave Bridge', category: 'landmark', lat: 30.2617, lng: -97.7452, neighborhood: 'Downtown', blurb: 'Home of 1.5M Mexican free-tailed bats. Emergence at dusk.', emoji: '🦇', keywords: ['Congress Bridge', 'Austin bats'], image: img('photo-1531218150217-54595bc2b934') },
  { id: 'zilker', name: 'Zilker Park', category: 'outdoors', lat: 30.2669, lng: -97.7729, neighborhood: 'Zilker', blurb: '350 acres of green space, home of ACL Fest.', emoji: '🌳', keywords: ['Zilker'], image: img('photo-1588993608283-7f0eda4438be') },
  { id: 'barton-springs', name: 'Barton Springs Pool', category: 'outdoors', lat: 30.2639, lng: -97.7713, neighborhood: 'Zilker', blurb: 'Spring-fed pool, 68°F year-round.', emoji: '🏊', keywords: ['Barton Springs'] },
  { id: 'moody-center', name: 'Moody Center', category: 'music', lat: 30.2818, lng: -97.7322, neighborhood: 'UT Campus', blurb: '15,000-seat arena for concerts and Longhorn hoops.', emoji: '🎤', keywords: ['Moody Center'] },
  { id: 'acl-live', name: 'ACL Live at the Moody Theater', category: 'music', lat: 30.2652, lng: -97.7473, neighborhood: '2nd Street', blurb: 'Home of Austin City Limits tapings.', emoji: '🎸', keywords: ['ACL Live', 'Moody Theater'] },
  { id: 'stubbs', name: "Stubb's BBQ", category: 'music', lat: 30.2685, lng: -97.7362, neighborhood: 'Red River', blurb: 'Outdoor amphitheater with smoked brisket.', emoji: '🍖', keywords: ["Stubb's"] },
  { id: 'mohawk', name: 'Mohawk', category: 'nightlife', lat: 30.2700, lng: -97.7361, neighborhood: 'Red River', blurb: 'Multi-level indie venue with a rooftop.', emoji: '🤘', keywords: ['Mohawk Austin'] },
  { id: 'sixth-street', name: 'Dirty Sixth', category: 'nightlife', lat: 30.2672, lng: -97.7394, neighborhood: 'Downtown', blurb: 'Bars, live music, and neon on E 6th St.', emoji: '🍻', keywords: ['6th Street', 'Sixth Street'] },
  { id: 'rainey', name: 'Rainey Street', category: 'nightlife', lat: 30.2588, lng: -97.7386, neighborhood: 'Rainey', blurb: 'Bungalow bars and food trucks.', emoji: '🏡', keywords: ['Rainey Street'] },
  { id: 'capitol', name: 'Texas State Capitol', category: 'landmark', lat: 30.2747, lng: -97.7404, neighborhood: 'Downtown', blurb: 'Taller than the U.S. Capitol, naturally.', emoji: '🏛️', keywords: ['Texas Capitol'] },
  { id: 'q2', name: 'Q2 Stadium', category: 'sports', lat: 30.3878, lng: -97.7197, neighborhood: 'North Burnet', blurb: 'Home of Austin FC. Verde all day.', emoji: '⚽', keywords: ['Q2 Stadium', 'Austin FC'] },
  { id: 'dkr', name: 'DKR Texas Memorial Stadium', category: 'sports', lat: 30.2837, lng: -97.7325, neighborhood: 'UT Campus', blurb: '100,000+ for Longhorns football.', emoji: '🏈', keywords: ['DKR', 'Longhorns'] },
  { id: 'franklin', name: 'Franklin Barbecue', category: 'food', lat: 30.2701, lng: -97.7313, neighborhood: 'East Austin', blurb: 'The line is the experience.', emoji: '🔥', keywords: ['Franklin Barbecue'] },
  { id: 'south-congress', name: 'South Congress', category: 'food', lat: 30.2500, lng: -97.7494, neighborhood: 'SoCo', blurb: 'Shops, tacos, and the "i love you so much" wall.', emoji: '🌮', keywords: ['South Congress', 'SoCo'] },
  { id: 'mount-bonnell', name: 'Mount Bonnell', category: 'outdoors', lat: 30.3207, lng: -97.7734, neighborhood: 'West Austin', blurb: 'Best sunset view of Lake Austin.', emoji: '🌅', keywords: ['Mount Bonnell'] },
]
