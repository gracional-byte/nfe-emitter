-- Adicionar coluna certificateContent para armazenar o certificado público X.509
ALTER TABLE `certificates` ADD `certificateContent` text;
