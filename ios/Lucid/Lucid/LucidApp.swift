import SwiftUI

@main
struct LucidApp: App {
    @StateObject private var store = LearningStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .tint(LucidColour.teal)
        }
    }
}

enum LucidColour {
    static let paper = Color(red: 0.957, green: 0.941, blue: 0.910)
    static let deepPaper = Color(red: 0.914, green: 0.886, blue: 0.843)
    static let ink = Color(red: 0.090, green: 0.173, blue: 0.173)
    static let muted = Color(red: 0.322, green: 0.380, blue: 0.373)
    static let teal = Color(red: 0.051, green: 0.365, blue: 0.357)
    static let darkTeal = Color(red: 0.035, green: 0.247, blue: 0.243)
    static let mint = Color(red: 0.725, green: 0.851, blue: 0.804)
    static let coral = Color(red: 0.937, green: 0.463, blue: 0.373)
    static let gold = Color(red: 0.824, green: 0.651, blue: 0.243)
}

struct LucidBackground: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(LucidColour.paper.ignoresSafeArea())
    }
}

extension View {
    func lucidBackground() -> some View { modifier(LucidBackground()) }
}
