import { useState } from "react";
import { View, Text, Image, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { QrCode } from "lucide-react-native";
import { PAYMENT_QR_BUCKET, PAYMENT_QR_OBJECT } from "@vagewell/shared";
import { PageHeader, Card } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/i18n";

/**
 * SCREEN_ID: ADMIN_PAYMENT_QR — the single UPI QR image clients see on
 * PaymentScreen. Read-only by design (user, 2026-08-11): admin/leaf_node no
 * longer get an in-app way to change it — only a developer with direct
 * Supabase access (Storage dashboard or SQL) can, and the `qr_admin_*`
 * storage policies were dropped (migration 0028) so this is enforced at the
 * database level too, not just by removing the button here.
 */
export function AdminPaymentQrScreen() {
  const { t } = useLanguage();
  const [loadFailed, setLoadFailed] = useState(false);
  const url = supabase.storage.from(PAYMENT_QR_BUCKET).getPublicUrl(PAYMENT_QR_OBJECT).data.publicUrl;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-slate-900" edges={[]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <PageHeader
          title={t("ops.paymentQr.title")}
          subtitle={t("ops.paymentQr.subtitle")}
        />

        <Card className="items-center gap-2 p-6">
          <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">{t("ops.paymentQr.currentQr")}</Text>
          {loadFailed ? (
            <View className="h-56 w-56 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 dark:border-slate-600 dark:bg-slate-800">
              <QrCode size={32} color="#9ca3af" />
              <Text className="mt-2 text-xs text-gray-400 dark:text-gray-500">{t("ops.paymentQr.noQr")}</Text>
            </View>
          ) : (
            <View className="h-56 w-56 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-slate-700">
              <Image
                source={{ uri: url }}
                style={{ width: 224, height: 224 }}
                resizeMode="contain"
                onError={() => setLoadFailed(true)}
              />
            </View>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
