// *1. Memuat dataset batas wilayah Indonesia (kecamatan)*
var Indonesia = ee.FeatureCollection('projects/ee-redhatdebian5/assets/kecamatanidnn');

// *2. Filter dataset untuk Provinsi Riau*
var riau = Indonesia.filter(ee.Filter.eq('NAME_1', 'Riau'));

// *3. Memuat dataset batas desa di Provinsi Riau (Level 4)*
var gadmRiau = ee.FeatureCollection('projects/ee-redhatdebian5/assets/Desa'); // Pastikan ini dataset yang benar

// *4. Filter hanya desa di Provinsi Riau*
var desaRiau = gadmRiau.filterBounds(riau);

// *5. Menampilkan daftar nama desa di Provinsi Riau*
var daftarDesa = desaRiau.aggregate_array('NAME_4'); // Ambil daftar nama desa
print('Daftar Nama Desa di Riau:', daftarDesa);

// *6. Mengambil koleksi citra Sentinel-2 untuk Provinsi Riau*
var dataset = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(riau) // Filter berdasarkan batas Provinsi Riau
  .filterDate('2023-01-01', '2023-12-31') // Rentang waktu 2023
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10)); // Hanya citra dengan awan < 10%

// *7. Fungsi untuk menghitung NDVI*
var calculateNDVI = function(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI'); // Band NIR (B8) dan Red (B4)
  return image.addBands(ndvi);
};

// *8. Menambahkan NDVI ke koleksi citra*
var ndviCollection = dataset.map(calculateNDVI);

// *9. Menghitung median NDVI untuk tahun 2023 dan memotong ke wilayah Provinsi Riau*
var ndviImage = ndviCollection.select('NDVI').median().clip(riau);

// *10. Visualisasi NDVI*
var ndviVis = {
  min: 0,
  max: 1,
  palette: ['red', 'yellow', 'green'], // Merah = rendah, kuning = sedang, hijau = tinggi
};
Map.addLayer(ndviImage, ndviVis, 'NDVI Provinsi Riau');

// *11. Mengambil data NDVI per desa*
var ndviStats = ndviImage.reduceRegions({
  collection: desaRiau,   // Koleksi desa di Provinsi Riau
  reducer: ee.Reducer.mean(), // Menghitung rata-rata NDVI per desa
  scale: 10,               // Resolusi Sentinel-2 (10m)
});

// *12. Filter hanya desa yang memiliki nilai NDVI (tanpa interpolasi)*
var validNDVIStats = ndviStats.filter(ee.Filter.neq('mean', null));

// *13. Menambahkan informasi kecamatan (kode dan nama) ke setiap desa*

// Ambil data kecamatan dari provinsi Riau, pastikan kolom kode kecamatan ada
var kecamatanData = Indonesia.filter(ee.Filter.eq('NAME_1', 'Riau')).select(['NAME_2', 'NAME_1', 'KODE_KCMTN']);  // Kode kecamatan dan nama kecamatan

// Gabungkan informasi kecamatan ke setiap desa berdasarkan hubungan spasial
var desaWithKecamatan = desaRiau.map(function(desa) {
  // Cari kecamatan yang tumpang tindih dengan desa ini
  var kecamatan = kecamatanData.filterBounds(desa.geometry()).first();
  var kecamatanNama = kecamatan.get('NAME_2');
  var kabupatenNama = kecamatan.get('NAME_1');
  var kodeKecamatan = kecamatan.get('KODE_KCMTN');
  
  // Tambahkan kolom-kolom tersebut ke dataset desa
  return desa.set({
    'Kecamatan': kecamatanNama,
    'Kabupaten': kabupatenNama,
    'Kode_Kecamatan': kodeKecamatan
  });
});

// *14. Gabungkan data kecamatan dan NDVI per desa*
var desaWithNDVI = validNDVIStats.map(function(desaStat) {
  var namaDesa = desaStat.get('NAME_4');
  var kecamatan = desaWithKecamatan.filter(ee.Filter.eq('NAME_4', namaDesa)).first();
  return desaStat.set({
    'Kecamatan': kecamatan.get('Kecamatan'),
    'Kabupaten': kecamatan.get('Kabupaten'),
    'Kode_Kecamatan': kecamatan.get('Kode_Kecamatan')
  });
});

// *15. Mengekspor data dengan kecamatan dan kabupaten ke CSV*
Export.table.toDrive({
  collection: desaWithNDVI,
  description: 'Valid_NDVI_PerDesa_Riau_WithKecamatanKabupaten_2023',
  fileFormat: 'CSV', // Format file yang diinginkan
  selectors: ['NAME_4', 'mean', 'Kecamatan', 'Kabupaten', 'Kode_Kecamatan'], // Kolom yang ingin disertakan
});
