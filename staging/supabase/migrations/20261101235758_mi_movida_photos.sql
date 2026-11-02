-- Storage policies for new uploads only; old photos and buckets are not modified.
BEGIN;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('mi-movida-photos','mi-movida-photos',true,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO NOTHING;
CREATE POLICY mi_movida_photo_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='mi-movida-photos' AND (storage.foldername(name))[1]=auth.uid()::text AND public.pif_current_integrante_id() IS NOT NULL);
CREATE POLICY mi_movida_photo_own_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='mi-movida-photos' AND (storage.foldername(name))[1]=auth.uid()::text AND public.pif_current_integrante_id() IS NOT NULL);
CREATE POLICY mi_movida_photo_own_delete ON storage.objects FOR DELETE TO authenticated
USING(bucket_id='mi-movida-photos' AND (storage.foldername(name))[1]=auth.uid()::text AND public.pif_current_integrante_id() IS NOT NULL);
COMMIT;
