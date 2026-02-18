import Foundation

@MainActor
final class DashboardManager {
    static let shared = DashboardManager()

    private var controller: DashboardWindowController?

    private init() {}

    func show(url: URL) {
        let controller = self.controller ?? DashboardWindowController()
        self.controller = controller
        controller.load(url: url)
        controller.show()
    }
}
