import AppKit
import Foundation
import WebKit

@MainActor
final class DashboardWindowController: NSWindowController, WKNavigationDelegate, NSWindowDelegate {
    private(set) var webView: WKWebView

    init() {
        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")

        self.webView = WKWebView(frame: .zero, configuration: config)
        self.webView.setValue(true, forKey: "drawsBackground")

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 820),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false)
        window.title = "OpenClaw Dashboard"
        window.contentView = self.webView
        window.isReleasedWhenClosed = false

        super.init(window: window)

        self.webView.navigationDelegate = self
        self.window?.delegate = self
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    func load(url: URL) {
        self.webView.load(URLRequest(url: url))
    }

    func show() {
        self.showWindow(nil)
        self.window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    // MARK: - WKNavigationDelegate

    @MainActor
    func webView(
        _: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void)
    {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        let scheme = url.scheme?.lowercased()

        // Keep regular web navigations inside the window.
        if scheme == "https"
            || scheme == "http"
            || scheme == "about"
            || scheme == "blob"
            || scheme == "data"
            || scheme == "javascript"
        {
            decisionHandler(.allow)
            return
        }

        // Only open external URLs when macOS has a registered handler.
        if let appURL = NSWorkspace.shared.urlForApplication(toOpen: url) {
            NSWorkspace.shared.open(
                [url],
                withApplicationAt: appURL,
                configuration: NSWorkspace.OpenConfiguration(),
                completionHandler: nil)
        }
        decisionHandler(.cancel)
    }
}
