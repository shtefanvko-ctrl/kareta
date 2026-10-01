import SwiftUI

@main
struct KaretaApp: App {
    @UIApplicationDelegateAdaptor(KaretaAppDelegate.self)
    private var appDelegate

    var body: some Scene {
        WindowGroup {
            KaretaWebView(
                startURL: URL(string: "https://kareta.kz/")!
            )
            .ignoresSafeArea(.container, edges: .bottom)
        }
    }
}
