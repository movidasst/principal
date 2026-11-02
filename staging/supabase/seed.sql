-- SYNTHETIC data only. No production data or secrets.
INSERT INTO public.integrantes(id,nombres,apellidos,documento,cedula,pais_iso2,pais_nombre,correo,codigo_integrante,carrera,moodle_user_id)
VALUES(1,'Coordinación','Ficticia','DEMO0001',NULL,'VE','Venezuela','coordinacion@example.invalid','A0001','Coordinación',1),
(900001,'Alex','Sintético','DEMO001',NULL,'CL','Chile','alex@example.invalid','A1B2C','Prevención de riesgos',101),
(900002,'Sol','Sintética','DEMO002',NULL,'VE','Venezuela','sol@example.invalid','D3E4F','Seguridad y salud',102);
INSERT INTO public.ranking_niveles VALUES(0,'Participante','🥉'),(1000,'Colaborador','⭐'),(2000,'Impulsor','🏅');
INSERT INTO public.estudio_sesiones VALUES('10000000-0000-4000-8000-000000000001','Cultura preventiva','SYN01',true);
INSERT INTO public.puntos_eventos(id,integrante_id,sesion_id,tipo,puntos,motivo,metadata,created_at) VALUES
('20000000-0000-4000-8000-000000000001',1,NULL,'actividad',5000,'Coordinación ficticia','{}','2026-10-25'),
('20000000-0000-4000-8000-000000000002',900001,'10000000-0000-4000-8000-000000000001','whatsapp_participacion',780,'Estudio sintético','{}','2026-10-25'),
('20000000-0000-4000-8000-000000000003',900001,NULL,'actividad',480,'Participación de grupo sintética','{"fuente":"inteligencia_grupo"}','2026-10-28'),
('20000000-0000-4000-8000-000000000004',900001,NULL,'actividad',250,'Consulta sintética','{}','2026-10-29'),
('20000000-0000-4000-8000-000000000005',900001,NULL,'actividad',150,'Competencia sintética','{}','2026-10-30'),
('20000000-0000-4000-8000-000000000006',900002,NULL,'actividad',1600,'Saldo sintético','{}','2026-10-30');
INSERT INTO public.participa_consultas VALUES('30000000-0000-4000-8000-000000000001','Próximos estudios · sintético');
INSERT INTO public.participa_respuestas VALUES('30000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',900001,'2026-10-29');
INSERT INTO public.participa_puntos_otorgados VALUES('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004');
INSERT INTO public.desarrolla_puntos_otorgados VALUES('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005');
INSERT INTO private.desarrolla_insignias_fixture VALUES(900001,'negociacion','2026-10-30',false),(900002,'liderazgo_preventivo','2026-10-30',false);
INSERT INTO private.desarrolla_certificados_fixture VALUES(900001,'negociacion','SYN-CERT-001','2026-10-30',true);

SELECT public.mi_movida_configure('http://127.0.0.1:54321');
