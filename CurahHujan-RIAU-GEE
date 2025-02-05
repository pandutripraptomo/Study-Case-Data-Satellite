// *1. Memuat dataset batas wilayah Indonesia (kecamatan)*
var Indonesia = ee.FeatureCollection('projects/ee-redhatdebian5/assets/kecamatanidnn');

// *2. Filter dataset untuk Provinsi Riau*
var riau = Indonesia.filter(ee.Filter.eq('NAME_1', 'Riau'));

// *3. Memuat dataset batas desa di Provinsi Riau (Level 4)*
var gadmRiau = ee.FeatureCollection('projects/ee-redhatdebian5/assets/Desa');

// *4. Filter hanya desa di Provinsi Riau*
var desaRiau = gadmRiau.filterBounds(riau);

// *5. Menampilkan daftar nama desa di Provinsi Riau*
var daftarDesa = desaRiau.aggregate_array('NAME_4');
print('Daftar Nama Desa di Riau:', daftarDesa);

// *6. Mengambil dataset curah hujan CHIRPS*
var chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY');

// *7. Filter dataset CHIRPS untuk tahun 2023 dan wilayah Provinsi Riau*
var rainData = chirps
  .filterBounds(riau)
  .filterDate('2023-01-01', '2023-12-31');

// *8. Fungsi untuk menghitung total curah hujan*
var calculateRainfall = function(image) {
  var rainfall = image.rename('precipitation');
  return image.addBands(rainfall);
};

// *9. Tambahkan band curah hujan ke koleksi citra*
var rainfallCollection = rainData.map(calculateRainfall);

// *10. Menghitung total curah hujan untuk tahun 2023 di Provinsi Riau*
var totalRainfallImage = rainfallCollection.sum().clip(riau);

// *11. Mengambil data curah hujan per desa*
var rainfallStats = totalRainfallImage.reduceRegions({
  collection: desaRiau,
  reducer: ee.Reducer.mean(),
  scale: 5000,  // Resolusi CHIRPS (5000m)
});

// *12. Filter hanya desa yang memiliki nilai curah hujan (tanpa interpolasi)*
var validRainfallStats = rainfallStats.filter(ee.Filter.neq('mean', null));

// *13. Gabungkan informasi kecamatan dan kabupaten ke setiap desa*
var kecamatanData = Indonesia.filter(ee.Filter.eq('NAME_1', 'Riau')).select(['NAME_2', 'NAME_1', 'KODE_KCMTN']);

// Gabungkan data kecamatan ke setiap desa
var desaWithKecamatan = desaRiau.map(function(desa) {
  var kecamatan = kecamatanData.filterBounds(desa.geometry()).first();
  var kecamatanNama = kecamatan.get('NAME_2');
  var kabupatenNama = kecamatan.get('NAME_1');
  var kodeKecamatan = kecamatan.get('KODE_KCMTN');
  return desa.set({
    'Kecamatan': kecamatanNama,
    'Kabupaten': kabupatenNama,
    'Kode_Kecamatan': kodeKecamatan
  });
});

// *14. Gabungkan data curah hujan dengan informasi kecamatan dan kabupaten per desa*
var desaWithRainfall = validRainfallStats.map(function(desaStat) {
  var namaDesa = desaStat.get('NAME_4');
  var kecamatan = desaWithKecamatan.filter(ee.Filter.eq('NAME_4', namaDesa)).first();
  return desaStat.set({
    'Kecamatan': kecamatan.get('Kecamatan'),
    'Kabupaten': kecamatan.get('Kabupaten'),
    'Kode_Kecamatan': kecamatan.get('Kode_Kecamatan'),
    'Total_Rainfall_mm': desaStat.get('mean')
  });
});

// *15. Mengekspor data curah hujan per desa ke CSV*
Export.table.toDrive({
  collection: desaWithRainfall,
  description: 'Rainfall_PerDesa_Riau_WithKecamatanKabupaten_2023',
  fileFormat: 'CSV',
  selectors: ['NAME_4', 'Total_Rainfall_mm', 'Kecamatan', 'Kabupaten', 'Kode_Kecamatan'],
});
