// URL polyfill must load before anything touches @supabase/supabase-js.
import "react-native-url-polyfill/auto";
import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);
