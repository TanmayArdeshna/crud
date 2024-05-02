const connection = require("./connection");
const cors = require("cors");
const PDFDocument = require("pdfkit");
const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const exceljs = require("exceljs");
const pdfParse = require("pdf-parse");
const mysql = require("mysql2/promise");
const moment = require('moment');

var app = express();

// Enable CORS for all routes
app.use(cors());

app.use(bodyParser.json());

app.get("/employee", (req, res) => {
  connection.query("select * from employee ", [req.params.id], (err, row) => {
    console.log(row);
    if (err) {
      console.log(err);
    } else {
      //console.log(row)
      res.status(200).json(row);
    }
  });
});

app.get("/employees_pagi", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  let page = parseInt(req.query.page);
  let pageSize = parseInt(req.query.pageSize);
  let from = req.query.from;
  let to = req.query.to;

  // Set default values if not provided or invalid
  page = isNaN(page) || page <= 0 ? 1 : page;
  pageSize = isNaN(pageSize) || pageSize <= 0 ? 5 : pageSize;

  const offset = (page - 1) * pageSize;

  // Adjust the SQL query to include date filtering
  let query = "SELECT * FROM employee";

  const filterConditions = [];

  if (from) {
    filterConditions.push("date >= ?");
  }

  if (to) {
    filterConditions.push("date <= ?");
  }

  if (filterConditions.length > 0) {
    query += " WHERE " + filterConditions.join(" AND ");
  }

  query += " LIMIT ?, ?";

  const filterValues = [];

  if (from) {
    filterValues.push(from);
  }

  if (to) {
    filterValues.push(to);
  }

  connection.query(
    query,
    [...filterValues, offset, pageSize],
    (error, results, fields) => {
      if (error) {
        console.error("Error executing MySQL query:", error);
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }

      const meta = {
        totalCount: results.length,
        totalPages: Math.ceil(results.length / pageSize),
        currentPage: page,
        pageSize: pageSize,
      };

      const responseData = {
        meta: meta,
        records: results,
      };

      if (results.length === 0) {
        res.status(404).json({ meta: meta, message: "No items found" });
        return;
      }

      res.json(responseData);
    }
  );
});

app.get("/showemployees/:id", (req, res) => {
  connection.query(
    "select * from employee where id=?",
    [req.params.id],
    (err, row) => {
      console.log(row);
      if (err) {
        console.log(err);
      } else {
        //console.log(row)
        res.send(row);
      }
    }
  );
});

app.delete("/deleteemployees/:id", (req, res) => {
  const employeeId = req.params.id;

  // Execute the DELETE query
  const query = connection.query(
    "DELETE FROM employee WHERE id = ?",
    [employeeId],
    (err, results) => {
      if (err) {
        // console.error('Error executing DELETE query:', err);
        return res.status(500).json({ error: "Internal server error" });
      }

      if (results.affectedRows === 0) {
        // No rows were deleted, meaning the employee with the given id was not found
        return res.status(404).json({ error: "Employee not found" });
      }

      res.status(200).json({ success: true });
    }
  );
});

app.post("/addemployees", (req, res) => {
  //var emp = req.body;
  const { name, phone, email, active, date } = req.body;
  //console.log(req.body);

  if (name !== null && phone !== null && email !== null && active !== null && date !== null) {
    //console.log("heree");
    const newData = {
      //id:id,
      name: name,
      phone: phone,
      email: email,
      active: active,
      date: date,
    };

    // Execute the INSERT INTO query
    const query = connection.query(
      "INSERT INTO employee SET ?",
      newData,
      (err, results) => {
        if (err) {
          console.error("Error executing INSERT INTO query:", err);
          return res.status(500).json({ error: "Internal server error" });
        }
        //console.log('Data inserted successfully:', results);
        // console.error('Error executing INSERT INTO query:', err);
        console.log("Data inserted successfully:", results);
        res.status(200).json({ success: true });
      }
    );
  }
});

app.patch("/editemployees", (req, res) => {
  var emp = req.body;

  connection.query(
    "UPDATE employee SET ? WHERE id=" + emp.id,
    emp,
    (err, row) => {
      console.log(row);
      if (err) {
        console.log(err);
        res.status(500).json({ error: err.message });
      } else {
        res.send(row);
      }
    }
  );
});
// Example server-side code for handling a PUT request
app.put("/updateemployee/:id", (req, res) => {
  const employeeId = req.params.id;
  const { name, email, phone, active, date } = req.body;

  // Check if the required fields are present
  if (date && name && email && phone && active !== undefined ) {
    // Execute the UPDATE query
    const query = connection.query(
      "UPDATE employee SET name=?, email=?, phone=?, active=?, date=? WHERE id=?",
      [name, email, phone, active, employeeId, date],
      (err, results) => {
        if (err) {
          // Handle database error
          console.error("Error executing UPDATE query:", err);
          return res.status(500).json({ error: "Internal server error" });
        }

        if (results.affectedRows === 0) {
          // No rows were updated, meaning the employee with the given id was not found
          return res.status(404).json({ error: "Employee not found" });
        }

        res.status(200).json({ success: true });
      }
    );
  } else {
    // If required fields are not provided
    res.status(400).json({ error: "Bad request - Missing required fields" });
  }
});

// Assuming you have an endpoint like /employees
app.get("/search", (req, res) => {
  const searchTerm = req.query.q;
  const fromDate = req.query.from;
  const toDate = req.query.to;

  console.log("Received Search Term:", searchTerm);
  console.log("Received From Date:", fromDate);
  console.log("Received To Date:", toDate);

  let query = "SELECT * FROM employee WHERE 1";
const queryParams = [];

if (searchTerm && searchTerm.trim() !== "") {
  query += " AND (id LIKE ? OR name LIKE ? OR email LIKE ? OR date LIKE ?)";
  queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
}

  if ((fromDate && toDate) || (fromDate && !toDate) || (!fromDate && toDate)) {
    // Handle date range filtering only if at least one of fromDate or toDate is present
    if (fromDate && toDate) {
      const fromDateFormatted = new Date(fromDate).toISOString().split('T')[0];
      const toDateFormatted = new Date(toDate).toISOString().split('T')[0];
      query += " AND DATE(date) BETWEEN ? AND ?";
      queryParams.push(fromDateFormatted, toDateFormatted);
    } else if (fromDate) {
      const fromDateFormatted = new Date(fromDate).toISOString().split('T')[0];
      const nextDay = new Date(new Date(fromDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      query += " AND DATE(date) BETWEEN ? AND ?";
      queryParams.push(fromDateFormatted, nextDay);
    } else if (toDate) {
      const toDateFormatted = new Date(toDate).toISOString().split('T')[0];
      const previousDay = new Date(new Date(toDate).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      query += " AND DATE(date) BETWEEN ? AND ?";
      queryParams.push(previousDay, toDateFormatted);
    }
  }

  console.log("SQL Query:", query);
  console.log("Query Parameters:", queryParams);

  connection.query(query, queryParams, (error, results, fields) => {
    if (error) {
      console.error("Error executing MySQL query:", error);
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }

    console.log("Query Results:", results);
    res.json(results);
  });
});






app.get("/get-table-data", (req, res) => {
  const { page, searchTerm } = req.query;

  // Ensure that page is a number, and fallback to 1 if it's not provided
  const currentPage = parseInt(page, 10) || 1;

  // Modify your SQL query to include pagination and search conditions
  const query = `
      SELECT * FROM employee
      WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? OR date LIKE?
      LIMIT ?, ?;
    `;

  let perPage = 5; // You can adjust this based on your requirements
  if (searchTerm) {
    perPage = 10;
  }
  const offset = (currentPage - 1) * perPage;

  // Execute the query with parameters
  connection.query(
    query,
    [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, offset, perPage],
    (error, results, fields) => {
      if (error) {
        console.error("Error executing MySQL query:", error);
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }

      // Create a new PDF document
      const pdfDoc = new PDFDocument();

      // Add content to the PDF (customize this based on your data structure)
      pdfDoc.text("Employee List", { align: "center" });
      pdfDoc.moveDown(); // Move the cursor down

      results.forEach((record) => {
        pdfDoc.text(
          `ID: ${record.id}, Name: ${record.name}, Email: ${record.email}, Phone: ${record.phone}, date:${record.date}`
        );
        pdfDoc.moveDown(); // Move the cursor down for the next line
      });

      // Set the response headers for file download
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=employee-list.pdf"
      );
      res.setHeader("Content-Type", "application/pdf");

      // Pipe the PDF file to the response
      pdfDoc.pipe(res);

      // End the PDF generation
      pdfDoc.end();
    }
  );
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const mysqlConnection = {
  host: "localhost",
  user: "root",
  password: "T@nmay4112",
  database: "employee",
};
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  try {
    const buffer = req.file.buffer;

    // Parse CSV data
    const csvData = await parseCSV(buffer);

    // Import CSV data into the database
    await importToDatabase(csvData);

    res.json({ message: "Data imported successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Function to parse CSV data
function parseCSV(buffer) {
  return new Promise((resolve, reject) => {
    const csvData = [];
    buffer
      .toString()
      .split("\n")
      .forEach((row) => {
        if (row.trim() !== "") {
          const rowData = row.trim().split(",");

          // Assuming the date is in the last column, convert its format
          const dateIndex = rowData.length - 1;
          if (dateIndex >= 0) {
            const dateParts = rowData[dateIndex].split("-");
            if (dateParts.length === 3) {
              // Convert date to 'YYYY-MM-DD' format
              rowData[dateIndex] = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
            }
          }

          csvData.push(rowData);
        }
      });
    resolve(csvData);
  });
}
async function importToDatabase(csvData) {
  const connection = await mysql.createConnection(mysqlConnection);
  try {
    await connection.query("BEGIN");

    // Assuming your CSV has a header row, and the columns match your database table columns
    const header = csvData.shift();

    // Construct SQL query for bulk insert
    const query = `INSERT INTO employee (${header.join(", ")}) VALUES ?`;

    // Execute bulk insert
    await connection.query(query, [csvData]);

    await connection.query("COMMIT");
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    await connection.end();
  }
}



app.listen(3000, () => console.log("Express server is running on port 3000"));
