router.post("/upload-products", upload.single("file"), async (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const products = rows.map((r) => ({
      brand: r["Brand"],
      modelNumber: Number(r["Model"]),
      itemCode: Number(r["Item Code"]),
      ean: Number(r["EAN"]),
      description: r["Item Description"],
      rspVat: Number(r["RSP+Vat"]),
    }));

    // 🔥 FORCE CLEAN
    await Product.deleteMany({});
    await Product.insertMany(products, { ordered: true });

    res.json({ success: true, count: products.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
