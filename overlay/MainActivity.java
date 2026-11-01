package in.grampanchayat.app;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GPPrintPlugin.class);   // आपला प्रिंट प्लगिन (नोंदवही/दाखले छापण्यासाठी)
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);   // ॲप नेहमी आडव्या (Landscape) स्थितीत उघडतो
        super.onCreate(savedInstanceState);
    }
}
