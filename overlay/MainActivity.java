package in.grampanchayat.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GPPrintPlugin.class);   // आपला प्रिंट प्लगिन (नोंदवही/दाखले छापण्यासाठी)
        super.onCreate(savedInstanceState);
    }
}
