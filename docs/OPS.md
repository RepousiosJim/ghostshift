# GhostShift Operations Notes

## Service Configuration

- **Port**: 3007
- **Framework**: Vite (dev server)
- **Public URL**: https://sharda-capitalistic-marla.ngrok-free.dev/ghostshift/
- **Systemd Service**: ghostshift.service

## Commands

```bash
# Start service
systemctl start ghostshift.service

# Stop service
systemctl stop ghostshift.service

# View logs
journalctl -u ghostshift.service -f

# Check status
systemctl status ghostshift.service
```

## Port Configuration

Updated `vite.config.js` to use port 3007 (was default 5173):
```javascript
server: {
  port: 3007,
  host: '0.0.0.0'
}
```

## Recent Fixes

- 2026-02-22: Fixed 502 error by configuring vite to run on port 3007 and creating systemd service for durability.
