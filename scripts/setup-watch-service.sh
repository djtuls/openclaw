#!/bin/bash
# Setup script for OpenClaw Memory Sync Watch Service
# This script manages the launchd service for bidirectional memory sync

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PLIST_SOURCE="$SCRIPT_DIR/com.openclaw.sync-memory-watch.plist"
PLIST_TARGET="$HOME/Library/LaunchAgents/com.openclaw.sync-memory-watch.plist"
LOG_DIR="$HOME/.openclaw/logs"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Function to check if service is loaded
is_loaded() {
    launchctl list | grep -q "com.openclaw.sync-memory-watch"
}

# Function to check if service is running
is_running() {
    launchctl list com.openclaw.sync-memory-watch 2>/dev/null | grep -q '"PID"'
}

case "${1:-}" in
    install)
        echo -e "${GREEN}Installing OpenClaw Memory Sync Watch Service...${NC}"
        
        # Copy plist to LaunchAgents
        cp "$PLIST_SOURCE" "$PLIST_TARGET"
        echo "✓ Copied plist to $PLIST_TARGET"
        
        # Load the service
        launchctl load "$PLIST_TARGET"
        echo "✓ Service loaded"
        
        sleep 2
        
        if is_running; then
            echo -e "${GREEN}✅ Service installed and running!${NC}"
            echo ""
            echo "Monitor logs with:"
            echo "  tail -f $LOG_DIR/sync-watch-stdout.log"
            echo "  tail -f $LOG_DIR/sync-watch-stderr.log"
        else
            echo -e "${YELLOW}⚠️  Service installed but not running. Check logs:${NC}"
            echo "  cat $LOG_DIR/sync-watch-stderr.log"
        fi
        ;;
        
    uninstall)
        echo -e "${YELLOW}Uninstalling OpenClaw Memory Sync Watch Service...${NC}"
        
        if is_loaded; then
            launchctl unload "$PLIST_TARGET" 2>/dev/null || true
            echo "✓ Service unloaded"
        fi
        
        if [ -f "$PLIST_TARGET" ]; then
            rm "$PLIST_TARGET"
            echo "✓ Plist removed"
        fi
        
        echo -e "${GREEN}✅ Service uninstalled${NC}"
        ;;
        
    start)
        if ! is_loaded; then
            echo -e "${RED}Service not installed. Run: $0 install${NC}"
            exit 1
        fi
        
        launchctl start com.openclaw.sync-memory-watch
        echo -e "${GREEN}✅ Service started${NC}"
        ;;
        
    stop)
        if ! is_loaded; then
            echo -e "${RED}Service not installed.${NC}"
            exit 1
        fi
        
        launchctl stop com.openclaw.sync-memory-watch
        echo -e "${GREEN}✅ Service stopped${NC}"
        ;;
        
    restart)
        if ! is_loaded; then
            echo -e "${RED}Service not installed. Run: $0 install${NC}"
            exit 1
        fi
        
        echo "Restarting service..."
        launchctl stop com.openclaw.sync-memory-watch 2>/dev/null || true
        sleep 1
        launchctl start com.openclaw.sync-memory-watch
        echo -e "${GREEN}✅ Service restarted${NC}"
        ;;
        
    status)
        if ! is_loaded; then
            echo -e "${RED}Service not installed${NC}"
            exit 1
        fi
        
        if is_running; then
            echo -e "${GREEN}✅ Service is running${NC}"
            launchctl list com.openclaw.sync-memory-watch
        else
            echo -e "${YELLOW}⚠️  Service is loaded but not running${NC}"
            echo ""
            echo "Recent errors:"
            tail -20 "$LOG_DIR/sync-watch-stderr.log" 2>/dev/null || echo "No error log found"
        fi
        ;;
        
    logs)
        if [ ! -f "$LOG_DIR/sync-watch-stdout.log" ]; then
            echo -e "${YELLOW}No logs yet${NC}"
            exit 0
        fi
        
        echo -e "${GREEN}=== STDOUT (last 50 lines) ===${NC}"
        tail -50 "$LOG_DIR/sync-watch-stdout.log"
        echo ""
        echo -e "${GREEN}=== STDERR (last 50 lines) ===${NC}"
        tail -50 "$LOG_DIR/sync-watch-stderr.log" 2>/dev/null || echo "No errors"
        ;;
        
    follow)
        echo -e "${GREEN}Following logs (Ctrl+C to exit)...${NC}"
        tail -f "$LOG_DIR/sync-watch-stdout.log"
        ;;
        
    *)
        echo "OpenClaw Memory Sync Watch Service Manager"
        echo ""
        echo "Usage: $0 {install|uninstall|start|stop|restart|status|logs|follow}"
        echo ""
        echo "Commands:"
        echo "  install    - Install and start the service"
        echo "  uninstall  - Stop and remove the service"
        echo "  start      - Start the service"
        echo "  stop       - Stop the service"
        echo "  restart    - Restart the service"
        echo "  status     - Check if service is running"
        echo "  logs       - View recent logs"
        echo "  follow     - Follow logs in real-time"
        exit 1
        ;;
esac
