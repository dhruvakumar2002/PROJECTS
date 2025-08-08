package com.streamrecordapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.VolumeProvider;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.util.ArrayList;
import java.util.List;

public class VolumeService extends Service {
    private static final String CHANNEL_ID = "VolumeServiceChannel";
    private static final int NOTIFICATION_ID = 1001;
    private static final long WINDOW_MS = 2500; // 2.5 seconds

    private MediaSession mediaSession;
    private final List<Long> volumeDownTimes = new ArrayList<>();

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        setupMediaSession();
    }

    private void setupMediaSession() {
        mediaSession = new MediaSession(this, "VolumeService");
        mediaSession.setActive(true);

        // Set playback state to playing so hardware volume keys control our session
        PlaybackState state = new PlaybackState.Builder()
                .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE)
                .setState(PlaybackState.STATE_PLAYING, 0, 1.0f)
                .build();
        mediaSession.setPlaybackState(state);

        VolumeProvider volumeProvider = new VolumeProvider(
                VolumeProvider.VOLUME_CONTROL_RELATIVE,
                /*max*/ 100,
                /*current*/ 50
        ) {
            @Override
            public void onAdjustVolume(int direction) {
                // direction: -1 = volume down, 1 = up, 0 = same
                if (direction < 0) {
                    onVolumeDown();
                }
                // We do not actually change volume here; system will handle it
            }
        };

        mediaSession.setPlaybackToRemote(volumeProvider);
    }

    private void onVolumeDown() {
        long now = System.currentTimeMillis();
        volumeDownTimes.add(now);
        // keep only last WINDOW_MS
        while (!volumeDownTimes.isEmpty() && now - volumeDownTimes.get(0) > WINDOW_MS) {
            volumeDownTimes.remove(0);
        }
        if (volumeDownTimes.size() >= 3) {
            volumeDownTimes.clear();
            launchWebActivity();
        }
    }

    private void launchWebActivity() {
        Intent intent = new Intent(this, WebActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(intent);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Volume Listener", NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        PendingIntent pi = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Background Listener")
                .setContentText("Triple press volume down to open stream")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, buildNotification());
        return START_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
    }
}
