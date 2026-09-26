INSERT INTO locations(id,name,level,country_code,geometry) VALUES
('world','World','WORLD',NULL,ST_SetSRID(ST_Point(-10,20),4326)),
('south-america','South America','CONTINENT',NULL,ST_SetSRID(ST_Point(-60,-15),4326)),
('cl','Chile','COUNTRY','CL',ST_SetSRID(ST_Point(-71,-33),4326)),
('valpo','Valparaiso Region','REGION','CL',ST_SetSRID(ST_Point(-71.3,-33.05),4326)),
('vina','Vina del Mar','LOCAL','CL',ST_SetSRID(ST_Point(-71.55,-33.02),4326)),
('santiago','Santiago','LOCAL','CL',ST_SetSRID(ST_Point(-70.65,-33.45),4326)),
('in','India','COUNTRY','IN',ST_SetSRID(ST_Point(78,22),4326)),
('sg','Singapore','COUNTRY','SG',ST_SetSRID(ST_Point(103.8,1.35),4326)),
('eu','European Union','CONTINENT',NULL,ST_SetSRID(ST_Point(10,50),4326))
ON CONFLICT (id) DO NOTHING;
INSERT INTO projects(id,name,type,status,evidence,sector,summary,impact,year,location_id,geometry,actors,tags,source_url,source_name,last_verified_at) VALUES
('pucv-ai','PUCV AI Research Activity','RESEARCH','ACTIVE','VERIFIED','Education','Research and academic AI activity in Valparaiso.','Research, talent and applied AI capability.',2026,'valpo',ST_SetSRID(ST_Point(-71.61,-33.04),4326),'["PUCV"]','["research","education"]','https://www.pucv.cl','PUCV',now()),
('chile-policy','Chile AI Policy','POLICY','DEPLOYING','ANNOUNCED','Government','National AI policy and governance activity.','Governance and public-sector coordination.',2025,'cl',ST_SetSRID(ST_Point(-70.67,-33.45),4326),'["Government of Chile"]','["policy","government"]','https://www.gob.cl','Government of Chile',now()),
('india-mission','IndiaAI Mission','GOVERNMENT','SCALING','VERIFIED','Government','National programme supporting AI compute, innovation and talent.','Compute, innovation and AI ecosystem development.',2024,'in',ST_SetSRID(ST_Point(77.2,28.6),4326),'["Government of India"]','["compute","talent"]','https://indiaai.gov.in','IndiaAI',now()),
('sg-physical','Punggol Physical AI','ROBOTICS','PILOT','REPORTED','Robotics','Physical AI and robotics activity in Singapore.','Automation and embodied AI experimentation.',2025,'sg',ST_SetSRID(ST_Point(103.91,1.4),4326),'["Singapore"]','["robotics","physical-ai"]','https://www.smartnation.gov.sg','Smart Nation Singapore',now()),
('eu-factories','EU AI Factories','INFRASTRUCTURE','BUILDING','ANNOUNCED','Compute','European AI compute infrastructure initiative.','AI compute capacity and research infrastructure.',2025,'eu',ST_SetSRID(ST_Point(10,50),4326),'["European Union"]','["compute","infrastructure"]','https://digital-strategy.ec.europa.eu','European Commission',now())
ON CONFLICT (id) DO NOTHING;
