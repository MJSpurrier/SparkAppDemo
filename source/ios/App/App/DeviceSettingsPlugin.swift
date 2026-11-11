import Capacitor
import UIKit

@objc(DeviceSettingsPlugin)
public class DeviceSettingsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DeviceSettingsPlugin"
    public let jsName = "DeviceSettings"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

    @objc func open(_ call: CAPPluginCall) {
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
            call.reject("Settings are unavailable")
            return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { _ in
                call.resolve()
            }
        }
    }
}
