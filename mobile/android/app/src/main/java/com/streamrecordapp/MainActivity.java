package com.streamrecordapp;

import android.content.Intent;
import android.os.Bundle;

import com.facebook.react.ReactActivity;

public class MainActivity extends ReactActivity {
  @Override
  protected String getMainComponentName() {
    return "StreamRecordApp";
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(null);
    // Start background service
    Intent svc = new Intent(this, VolumeService.class);
    startService(svc);
  }
}
