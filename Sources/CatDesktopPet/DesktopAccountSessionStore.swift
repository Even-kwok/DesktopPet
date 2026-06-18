import Foundation

struct DesktopAccountSession: Codable, Equatable {
    let id: String
    let name: String
    let email: String
    let credits: Int
    let accessToken: String
    let signedInAt: String
}

final class DesktopAccountSessionStore {
    private enum Keys {
        static let currentAccount = "desktopAccount.current"
    }

    private let defaults: UserDefaults
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var currentAccount: DesktopAccountSession? {
        guard let data = defaults.data(forKey: Keys.currentAccount) else {
            return nil
        }

        return try? decoder.decode(DesktopAccountSession.self, from: data)
    }

    var isSignedIn: Bool {
        currentAccount != nil
    }

    func save(_ account: DesktopAccountSession) {
        guard let data = try? encoder.encode(account) else {
            return
        }

        defaults.set(data, forKey: Keys.currentAccount)
    }

    func signOut() {
        defaults.removeObject(forKey: Keys.currentAccount)
    }
}
