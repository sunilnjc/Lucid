import SwiftUI
import UIKit

@main
struct LucidApp: App {
    @StateObject private var store = LearningStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .tint(LucidColour.mint)
        }
    }
}

enum LucidColour {
    static let paper = Color(red: 0.957, green: 0.941, blue: 0.910)
    static let deepPaper = Color(red: 0.914, green: 0.886, blue: 0.843)
    static let ink = Color(red: 0.090, green: 0.173, blue: 0.173)
    static let midnight = Color(red: 0.018, green: 0.075, blue: 0.082)
    static let nightTeal = Color(red: 0.027, green: 0.184, blue: 0.180)
    static let surface = Color(red: 0.035, green: 0.125, blue: 0.133)
    static let raisedSurface = Color(red: 0.055, green: 0.178, blue: 0.180)
    static let textOnDark = Color.white.opacity(0.96)
    static let secondaryOnDark = Color.white.opacity(0.68)
    static let muted = Color(red: 0.322, green: 0.380, blue: 0.373)
    static let teal = Color(red: 0.051, green: 0.365, blue: 0.357)
    static let darkTeal = Color(red: 0.035, green: 0.247, blue: 0.243)
    static let mint = Color(red: 0.725, green: 0.851, blue: 0.804)
    static let coral = Color(red: 0.937, green: 0.463, blue: 0.373)
    static let gold = Color(red: 0.824, green: 0.651, blue: 0.243)
}

struct LucidNightBackground: View {
    var body: some View {
        LinearGradient(
            colors: [LucidColour.midnight, LucidColour.darkTeal, LucidColour.ink],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

struct LucidBackground: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(LucidNightBackground().ignoresSafeArea())
    }
}

extension View {
    func lucidBackground() -> some View { modifier(LucidBackground()) }

    func lucidHomeNavigation() -> some View {
        toolbar { ToolbarItem(placement: .topBarLeading) { LucidHomeButton() } }
    }

    /// Text editors and the email-code number pad do not have a Return-to-dismiss key.
    func lucidKeyboardDismissal() -> some View {
        scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") {
                        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                    }
                    .accessibilityLabel("Dismiss keyboard")
                }
            }
    }
}

struct LucidHomeButton: View {
    @EnvironmentObject private var store: LearningStore
    var body: some View {
        Button(action: store.openHome) {
            HStack(spacing: 6) {
                Image(systemName: "house")
                Text("Home")
            }.frame(minHeight: 44)
        }
        .tint(LucidColour.mint)
        .accessibilityLabel("Home")
        .accessibilityIdentifier("navigation.home")
        .accessibilityHint("Returns to the welcome screen without resetting your learning or drafts.")
    }
}

enum LucidAccessibility {
    @MainActor static func announce(_ message: String) {
        UIAccessibility.post(notification: .announcement, argument: message)
    }
}
