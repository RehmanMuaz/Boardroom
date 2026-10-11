# Private phone testing

Install Tailscale on the development computer and phone, and sign in to the same network. Enable MagicDNS and HTTPS for that network when prompted by Tailscale Serve. This serves a private preview rather than publishing through Funnel.

Stop existing local frontend/API processes on ports 5173/3001, then run from the Boardroom directory:

```powershell
npm.cmd run dev:remote
```

The command prints the computer's private HTTPS address. Open it in the phone browser with Tailscale connected, including when on cellular. Use that same address from the computer while this mode is running: the API deliberately requires an exact origin.

The launcher runs the API and Vite, configures the origin and secure cookies only for those processes, trusts the loopback proxy, and enables Tailscale Serve to proxy HTTPS/WebSockets to Vite. Vite accepts the configured hostname and refuses to silently change ports. The private `.env` remains unchanged; production configuration and data are not modified. The existing local development database/uploads are used. Keep the computer awake and the command running.

Ctrl+C stops the preview and its API process. Local API logs are in the ignored `.deploy-test` directory. To return to normal local testing, use the usual `dev:api` and `dev` commands in new terminals at http://localhost:5173.

If Windows asks for permission to install Tailscale, approve the installer. If sign-in or HTTPS setup is needed, complete it in Tailscale's browser flow; do not paste account credentials into chat. A phone on another network must have Tailscale connected to the same network before this private URL can open.
