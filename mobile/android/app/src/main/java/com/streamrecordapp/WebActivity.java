package com.streamrecordapp;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

public class WebActivity extends AppCompatActivity {
    private static final String URL = "http://10.28.159.141:3000/live?autoStart=1";

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Open external browser to the deep link that triggers auto start on the site
        Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(URL));
        startActivity(browserIntent);
        finish();
    }
}
