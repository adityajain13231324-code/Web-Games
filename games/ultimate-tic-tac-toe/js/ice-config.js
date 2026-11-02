/* Optional: your own TURN relay, for reliable online play between different networks (mobile data, strict Wi-Fi).
   Leave the list empty to use only the built-in free servers. To add one (free tiers exist at metered.ca and Cloudflare Calls):
   create an account, copy the TURN host, username and credential, and replace the list below, for example:

   window.UTTT_ICE_SERVERS = [
     { urls: ['turn:YOUR-HOST:80', 'turn:YOUR-HOST:443?transport=tcp', 'turns:YOUR-HOST:443?transport=tcp'], username: 'YOUR-USERNAME', credential: 'YOUR-CREDENTIAL' },
   ];

   These values are visible to every visitor (that is normal for browser WebRTC), so use a free-tier account, not a paid one. */
window.UTTT_ICE_SERVERS = [];
