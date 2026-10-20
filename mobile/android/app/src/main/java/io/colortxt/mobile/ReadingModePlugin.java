package io.colortxt.mobile;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ReadingMode")
public class ReadingModePlugin extends Plugin {
    private boolean enabled = false;

    private void applyMode() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
            getActivity().getWindow(), getActivity().getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        if (enabled) controller.hide(WindowInsetsCompat.Type.systemBars());
        else controller.show(WindowInsetsCompat.Type.systemBars());
    }

    @PluginMethod
    public void setImmersive(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
            applyMode();
            call.resolve();
        });
    }

    @Override
    protected void handleOnResume() {
        getActivity().runOnUiThread(this::applyMode);
    }
}
