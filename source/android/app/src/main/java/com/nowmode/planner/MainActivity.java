package com.nowmode.planner;

import com.getcapacitor.BridgeActivity;

import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceSettingsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
