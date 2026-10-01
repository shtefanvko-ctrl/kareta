import SwiftUI

@main
struct KaretaApp: App {
    var body: some Scene {
        WindowGroup {
            KaretaWebView(startURL: URL(string: "https://kareta.kz/")!)
                .ignoresSafeArea(.container, edges: .bottom)
        }
    }
}
