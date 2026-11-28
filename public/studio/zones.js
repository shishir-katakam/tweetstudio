// Clearances for critical content in typical mobile LTR placements. Organic
// overlays vary by device and caption. Background art fills the whole frame.
const zone=(left,right,top,bottom)=>Object.freeze({left,right,top,bottom});
const feed=zone(.055,.055,.055,.055), igCarousel=zone(.055,.095,.075,.055);
const story=zone(.06,.06,.14,.35), pin=zone(65/1080,195/1080,270/1920,790/1920);
const tiktok=zone(80/720,200/720,160/1280,440/1280), tiktokSquare=zone(.06,.15,.065,.13);
const video={
  // Meta Reels ads: 14% top, 35% bottom, 6% sides. Our increased right
  // clearances allow additional room for the organic action rail.
  Instagram:zone(.06,.19,.14,.35), Facebook:zone(.06,.17,.14,.35),
  LinkedIn:zone(.065,.16,.085,.25), X:zone(.065,.105,.09,.24),
  Threads:zone(.055,.10,.065,.13), TikTok:tiktok, Pinterest:pin,
  YouTube:zone(48/1080,192/1080,288/1920,672/1920)
};
export function safeZone(platform,kind,size){
  if(kind==="Reel")return video[platform]||feed;
  if(size==="Story"&&["Instagram","Facebook"].includes(platform))return story;
  if(platform==="Pinterest")return pin;
  if(platform==="TikTok")return size==="Square"?tiktokSquare:tiktok;
  if(platform==="Instagram"&&kind==="Carousel")return igCarousel;
  return feed;
}
export const zoneSources=Object.freeze({
  Instagram:"https://www.facebook.com/business/ads-guide/update/video/instagram-reels",
  InstagramStory:"https://www.facebook.com/business/ads-guide/update/image/instagram-story",
  Facebook:"https://www.facebook.com/business/ads-guide/update/image/facebook-facebook-reels",
  LinkedIn:"https://www.linkedin.com/help/linkedin/answer/a6828542",
  Pinterest:"https://help.pinterest.com/en/article/review-pin-specs",
  X:"https://business.x.com/en/products/vertical-video-ads",
  Threads:"https://about.fb.com/news/2025/03/new-threads-features-more-personalized-experience-you-control/",
  TikTok:"https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads",
  YouTube:"https://support.google.com/google-ads/answer/9128498"
});
